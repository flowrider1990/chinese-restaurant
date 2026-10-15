# Gift vouchers with Stripe: design

Status: draft for review, 2026-10-14. Branch: `feature/vouchers`.

## Goal

Guests buy a gift voucher on the website and pay through Stripe (sandbox / test mode only). The
buyer receives the voucher by e-mail as a code and a PDF. Staff redeem it in the restaurant and
deduct the amount in the CMS admin, partially if needed, with a permanent history.

This extends the original plan, which excluded online payments. The user requested it; the site
is a demo and runs against the Stripe sandbox only.

## Decisions (agreed in chat)

| Topic | Decision |
|---|---|
| Amounts | Quick picks 25, 50, 100 € or a free amount of 10–300 €, whole euros. |
| Payment | Stripe Checkout (hosted payment page) plus webhook. No card data on our site. Further payment methods (PayPal, Apple Pay, Google Pay) are switched on in the Stripe dashboard, not in code. |
| Delivery | E-mail to the buyer with the code in the text and a PDF attached. The buyer passes it on. |
| Gift details | Recipient name and a message (max. 200 characters), both optional, printed on the PDF. |
| Redemption | Only in the restaurant. Staff deduct amounts in the admin; partial redemptions allowed; history cannot be edited. |
| Validity | Until 31 December of the third year after purchase (German regular limitation period, §§ 195, 199 BGB). Printed on the PDF. |
| Cancellation / refunds | Not automated. Staff can set a voucher to "cancelled" in the admin; a refund is made in the Stripe dashboard. |
| Retention | Voucher records are business records and are not deleted automatically. |
| Approach | Everything inside the existing Payload CMS and Next.js app, like reservations. |

## Architecture

```
Buyer ─▶ /gutscheine (/en/vouchers)
          VoucherForm (client)
          │ submit (Server Action)
          ▼
        startVoucherCheckout()  ── validates on the server, creates the voucher (status pending),
          │                        creates a Stripe Checkout Session, stores its id
          ▼
        303 redirect to Stripe Checkout ── buyer pays (test card 4242 4242 4242 4242)
          │                                  │
          │ success_url                      │ webhook (signed)
          ▼                                  ▼
        /gutscheine?session_id=…           POST /api/vouchers/stripe-webhook
          shows status from our DB           handleStripeEvent()
                                               checkout.session.completed → markPaid()
                                                 code, validUntil, PDF, mails
                                               checkout.session.expired → status expired

Admin ─▶ Vouchers collection: search by code, add redemptions, cancel
```

### Units

| Unit | Purpose | Depends on |
|---|---|---|
| `src/lib/voucher-rules.ts` | Pure functions: `checkVoucherRequest(input)` → list of problems, `amountToCents()`, `validUntil(paidAt)`, `remaining(amount, redemptions)`, `checkRedemptions(previous, next, amount)`. | – |
| `src/lib/voucher-code.ts` | `generateCode()` → `XC-XXXX-XXXX` from an alphabet without look-alike characters (no 0/O, 1/I/L), using `crypto.randomInt`. | Node `crypto` |
| `src/lib/stripe.ts` | One Stripe client from `STRIPE_SECRET_KEY` (server only, `import 'server-only'`). Refuses a live key (`sk_live_`) so the demo can never charge real money. | `stripe` |
| `src/lib/voucher-checkout.ts` | `startVoucherCheckout(input, locale)`: create pending voucher, create Checkout Session, store session id, return the Stripe URL. | rules, stripe, Local API |
| `src/lib/voucher-webhook.ts` | `handleStripeEvent(rawBody, signature)`: verify the signature, dispatch by event type, idempotent state changes. | stripe, Local API, fulfilment |
| `src/lib/voucher-fulfilment.ts` | `markPaid(voucherId, session)`: pending → paid exactly once, set code, `paidAt`, `validUntil`, then send mails. | code, pdf, mails |
| `src/lib/voucher-pdf.ts` | `voucherPdf(voucher, site, locale)` → `Uint8Array`. A5 landscape, built-in Helvetica (covers € and umlauts). | `pdf-lib` |
| `src/lib/voucher-mails.ts` | Buyer mail (DE/EN, code in text, PDF attached) and a short notice to the restaurant. | Payload `sendEmail` |
| `src/collections/Vouchers.ts` | Stored vouchers, admin list, access, redemption hooks, webhook endpoint. | rules, webhook |
| `src/app/(frontend)/[locale]/gutscheine/` | Page, form (client), Server Action; the same page shows the thank-you state when called with `?session_id=`. | checkout |

Route map gets `vouchers: { de: 'gutscheine', en: 'vouchers' }`. The thank-you state is the same
page with `?session_id=…` (the proxy only translates the first path segment, so a nested
`danke`/`thanks` segment would need extra routing for no benefit).

Copy uses the formal "Sie", like the rest of the site and the reservation mails.

### Data model: `vouchers`

| Field | Type | Notes |
|---|---|---|
| `code` | text, unique, indexed | Empty while pending; set when paid. Used as the admin title. |
| `status` | select | `pending`, `paid`, `expired`, `cancelled`. |
| `amount` | number (cents) | Fixed at creation; read-only in the admin. |
| `balance` | number (cents) | Computed in a hook as amount − sum of redemptions; read-only. |
| `buyerName`, `buyerEmail` | text, email | Required. E-mail normalised like reservations. |
| `recipientName` | text | Optional, max. 80 characters. |
| `message` | textarea | Optional, max. 200 characters. |
| `locale` | select | Language of the mail and PDF. |
| `stripeSessionId` | text, unique | Links the webhook event to the voucher. |
| `stripePaymentIntent` | text | For finding the payment in the Stripe dashboard. |
| `paidAt`, `validUntil` | date | Set on payment. |
| `redemptions` | array: `amount` (cents), `note`, `redeemedAt`, `by` (user), `recordedAt`, `recordedBy` (user) | Append-only. `redeemedAt` (default now) and `by` (default the logged-in user) are chosen by staff; `recordedAt`/`recordedBy` are stamped by the server and read-only (changed 2026-10-15, user decision; before, the server set `redeemedAt` and `by`). |

Access: no public read, create, update or delete. Create only through the server code
(`overrideAccess: true` in `startVoucherCheckout`). Signed-in staff read, update (redemptions,
status `cancelled`) and may delete only `expired` vouchers and `pending` ones older than one hour (the Stripe page stays
payable for 31 minutes; deleting earlier could lose a payment).

## Website

- **Form**: amount chips 25 / 50 / 100 € plus "Anderer Betrag" (number input, 10–300). Name,
  e-mail, optional recipient name and message, privacy checkbox, honeypot field like the
  reservation form. Button "Zahlungspflichtig bestellen" / "Order and pay". A visible demo note:
  "Demo: Es wird nichts abgebucht. Testkarte 4242 4242 4242 4242, beliebiges Datum in der Zukunft
  und beliebige Prüfziffer."
- **Server Action**: validates everything again; on success redirects to Stripe. On a Stripe error
  the form shows "Bezahlung gerade nicht möglich, bitte später noch einmal" and the pending voucher
  is set to `expired`.
- **Checkout Session**: `mode: 'payment'`, one line item with `price_data` (EUR, amount in cents,
  product name "Gutschein Xiao Chu"), `customer_email`, `locale`, `metadata.voucherId`,
  `client_reference_id`, `expires_at` now + 31 minutes (Stripe requires at least 30), `success_url` with
  `{CHECKOUT_SESSION_ID}`, `cancel_url` back to the form.
- **Thank-you state** (`?session_id=`): looks up the voucher by session id in our DB (not in
  Stripe) and shows one of: paid → "Vielen Dank! Ihr Gutschein ist per E-Mail unterwegs.";
  pending → "Zahlung wird bestätigt …" with a reload link; unknown → neutral message with a link
  back. It never shows the code or personal data. `noindex`.
- Navigation: "Gutscheine" in the main menu (user decision 2026-10-14) and a link on the restaurant page; not in the footer.

## Webhook

- Endpoint `POST /api/vouchers/stripe-webhook` as a Payload collection endpoint. The raw request
  body is needed for the signature; the plan verifies how the Payload 3.90 endpoint exposes it
  (`req.text()`), with a Next.js route handler outside `/api` as fallback.
- Signature checked with `stripe.webhooks.constructEvent` and `STRIPE_WEBHOOK_SECRET`. Invalid →
  400, nothing changed.
- `checkout.session.completed` with `payment_status: 'paid'`, and
  `checkout.session.async_payment_succeeded` (delayed methods), → `markPaid`. The state change is
  conditional (only from `pending`), so a repeated event does nothing and sends no second mail.
- `checkout.session.expired` → `pending` becomes `expired`.
- Other events → 200, ignored.
- Mail failure after payment: the voucher stays `paid` with its code (the money is taken); the
  error is logged and the restaurant notice says so, so staff can resend the code by hand. The
  webhook still answers 200 so Stripe does not retry into a second code.
- Local testing: `stripe listen --forward-to localhost:3000/api/vouchers/stripe-webhook` prints
  the `whsec_…` secret for `.env`.

## E-mails and PDF

- **Buyer** (DE/EN by `locale`): subject "Ihr Gutschein für Xiao Chu", amount, code, valid until,
  how to redeem (show the code or PDF in the restaurant), PDF attached as
  `gutschein-XC-XXXX-XXXX.pdf`. The plan checks that the Resend adapter passes attachments; if not,
  the mail is sent through the Resend API directly.
- **Restaurant** (to the reservation notification address): "Gutschein verkauft: 50 €, Code …".
- **PDF**: restaurant name, "Gutschein" / "Gift voucher", amount, code, optional recipient and
  message, valid until, address and phone from the site settings, "Demo" mark.

## Rules and edge cases

- Amount: integer euros, 10–300; quick picks are just preset values of the same field.
- Text fields trimmed; length limits enforced on the server.
- Redemption: amount > 0, at most the current balance; only for `paid` vouchers. Existing rows
  cannot be changed or removed (compared in `beforeChange`, including date, staff member and the
  audit stamps; relationships compared by id).
- Redemption date and staff member (2026-10-15, user decision): a new row's `redeemedAt` is
  required (server default now), at most 5 minutes in the future (clock skew), not before
  `paidAt` and not after `validUntil`, so a redemption made within the validity may be entered
  later. `by` is required (default the current user) and must be an existing user.
  `recordedAt` = now and `recordedBy` = the signed-in user (null for server code) are always set by
  the server for new rows.
- `cancelled` vouchers cannot be redeemed; `cancelled` can only be set from `paid`.
- A live Stripe key is refused at startup of the Stripe client.

## Privacy and legal (demo)

- Privacy placeholder: Stripe as payment processor (recipient of buyer name, e-mail and payment
  data), purpose and legal basis (contract), retention as business records.
- `docs/legal-checklist.md`: terms and conditions (AGB), right of withdrawal for vouchers, and the
  button wording are open items before any real sale.
- Demo note on the page and the PDF.

## Testing

- Unit: `checkVoucherRequest` (bounds, non-integer, missing fields, length limits),
  `generateCode` (format, alphabet), `validUntil`, `remaining`, `checkRedemptions`.
- Integration (test DB, Stripe calls mocked at the client boundary; webhook signatures generated
  with `stripe.webhooks.generateTestHeaderString`): valid event → paid, code set, one mail;
  same event twice → one mail; bad signature → 400 and no change; expired event; redemption over
  balance rejected; editing an existing redemption rejected; anonymous read/create denied.
- Manual: full purchase with `stripe listen` and the test card, mail with PDF arrives, partial
  redemption in the admin.

## Out of scope

Online redemption, automatic refunds from Stripe events, invoices, postal delivery, voucher
designs to choose from, discount codes.

## Configuration

| Variable | Where | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | `.env` | Test key only (`sk_test_…`). |
| `STRIPE_WEBHOOK_SECRET` | `.env` | From `stripe listen` locally; from the dashboard webhook in a deployment. |

New dependencies: `stripe`, `pdf-lib`. No `NEXT_PUBLIC_` variables.
