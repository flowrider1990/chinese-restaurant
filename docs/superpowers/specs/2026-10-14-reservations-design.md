# Table reservations: design

Status: draft for review, 2026-10-14. Branch: `feature/reservations`.

## Goal

Guests request a table on the website (e.g. 4 people at 12:30) without an account. The
restaurant confirms or declines each request in the existing CMS admin. Guests and the restaurant
are informed by e-mail. This replaces the earlier plan decision "reservations by phone only".

## Decisions (agreed in chat)

| Topic | Decision |
|---|---|
| Model | Request, not instant booking. The restaurant confirms or declines manually. No table plan. |
| External providers | Not now. Quandoo is shutting down (no new bookings since 2026-09-30); OpenTable is costly and its widget would add third-party scripts. An admin setting can switch the site to an external booking link later without code changes. |
| Guest data | Name and e-mail required; phone and note optional. |
| E-mails | New request → restaurant. Receipt → guest. Confirmed/declined → guest. Sent with Resend. |
| Slots | 15-minute steps within the opening hours. |
| Last booking | 60 minutes before each opening slot ends. |
| Lead time | At least 1 hour from now. |
| Horizon | Up to 60 days ahead. |
| Party size | 1–8 online; larger groups are asked to call (phone number shown). |
| Closed days | Days without opening hours and "closed" exceptions cannot be booked. |
| Retention | Personal data (name, e-mail, phone, note) is removed 1 month after the reservation date. Date, time, party size and status stay as anonymous statistics. Within that month the restaurant may see who books often (search by e-mail); this purpose is stated in the privacy policy. No guest file beyond one month (that would need consent). |
| Approach | Everything inside the existing Payload CMS and Next.js app. |

All numeric rules are editable in the admin.

## Architecture

```
Guest ─▶ /reservieren (/en/reserve)
          ReservationForm (client) ── available times computed with the same pure function as the server
          │ submit (Server Action)
          ▼
        requestReservation()  ── validates everything again on the server (rules, hours, honeypot)
          │ Local API create
          ▼
        reservations collection (Payload, admin-only access)
          │ afterChange hook
          ▼
        sendReservationMails() ── Payload email adapter: Resend if RESEND_API_KEY is set, otherwise
                                  the console (development)

Daily: GET /api/reservations/cleanup (Bearer CRON_SECRET) ─▶ anonymiseExpiredReservations()
Local: pnpm reservations:cleanup
```

### Units

| Unit | Purpose | Depends on |
|---|---|---|
| `src/lib/reservation-rules.ts` | Pure functions: `availableTimes(hours, rules, date, now)`, `bookableDates(...)`, `checkRequest(input, hours, rules, now)` → list of problems. Shared by form and server. | `opening-hours.ts` (`slotsFor`) |
| `src/collections/Reservations.ts` | Stored requests, admin list, status workflow, hooks. | access rules, mails |
| `src/globals/ReservationSettings.ts` | Mode (form / external link / off), external URL, rules, notification address, retention. | – |
| `src/lib/reservation-mails.ts` | Builds the three e-mails (DE/EN, plain text plus simple HTML) and sends them. | Payload `sendEmail` |
| `src/lib/reservation-cleanup.ts` | Removes personal data after the retention period. | Payload Local API |
| `src/app/(frontend)/[locale]/reservieren/` | Page, form (client), Server Action. | rules, collection |

### Data model: `reservations`

| Field | Type | Notes |
|---|---|---|
| `date` | text `YYYY-MM-DD` | Local date in Europe/Berlin. |
| `time` | text `HH:MM` | Local time. |
| `startsAt` | date (UTC) | Derived from date + time in a hook; used for sorting and retention. Read-only in the admin. |
| `partySize` | number 1–max | |
| `name`, `email` | text, email | Required; max. lengths. |
| `phone` | text | Optional. |
| `note` | textarea | Optional, max. 500 characters. |
| `status` | select | `requested` (default), `confirmed`, `declined`. |
| `messageToGuest` | textarea | Optional text included in the confirmation/decline mail (e.g. "We can offer 13:00 instead."). |
| `locale` | select de/en | Language of the guest mails. |
| `privacyAcceptedAt` | date | Set by the server on submit. |
| `anonymisedAt` | date | Set by the cleanup; personal fields are then empty. |

Access: create, read, update and delete for logged-in editors only. The public form never uses
the REST API; the Server Action creates the document after its own validation.

Admin list: date, time, persons, name, status, newest requests first by default; filter by status
and date; search by name and e-mail.

### Settings: `reservation-settings` global

`mode` (form / external / off), `externalUrl`, `slotMinutes` (15), `lastBookingBeforeCloseMinutes`
(60), `leadTimeMinutes` (60), `horizonDays` (60), `maxPartySize` (8), `notificationEmail` (falls
back to the restaurant e-mail), `retentionDays` (30).

## Website

- New page `/reservieren`, English `/en/reserve` (route key `reserve`).
- "Tisch reservieren" links: main navigation, home hero (next to "Speisekarte"), mobile action
  bar. The mobile bar becomes: Anrufen · Speisekarte · Reservieren · Bestellen (icon above a short
  label, so four fit at 375 px).
- `mode = external`: all those links go to the external URL (new tab, marked external).
  `mode = off`: links and page are hidden (the page returns 404).
- Form: date (native date picker limited to bookable days), time (select with the available
  times for that date), persons (1–max, with "more than 8? please call 030 …"), name, e-mail,
  phone (optional), note (optional), required checkbox "I have read the privacy policy" with link.
  A hidden honeypot field catches simple bots; no captcha, no third-party service.
- After sending: a confirmation panel ("Your request for 4 people on Sat, 18 Oct at 12:30 has
  been received. We will reply by e-mail.").
- Errors: shown next to the field and summarised at the top; the form keeps the entered values.

## E-mails

| When | To | Content |
|---|---|---|
| New request | Restaurant (`notificationEmail`) | Date, time, persons, name, e-mail, phone, note, link to the request in the admin. |
| New request | Guest | Receipt: details, "this is a request, not yet a confirmation", restaurant phone. |
| Status → confirmed | Guest | Confirmation with details, address, phone; optional message. |
| Status → declined | Guest | Polite decline; optional message (e.g. alternative time); phone. |

Language follows the guest's site language. Sender: `EMAIL_FROM` (env). Mails are sent after the
document is saved; a failed send is logged with the reservation id and does not undo the save.
The admin shows the request regardless, so a lost mail never loses a reservation.

## Rules and edge cases

- The server is authoritative: it recomputes the available times and rejects anything else,
  including manipulated form values.
- Slots that run past midnight: bookable times end at the slot's close minus 60 minutes; a time
  after midnight is not offered (simplification; the restaurant closes at 22:30).
- Exceptions (holidays, special hours) override the weekly hours, as on the website.
- Duplicate submissions (double click): the button is disabled while sending; the server ignores
  an identical request (same e-mail, date and time) within 10 minutes.
- No rate limiting service now (no hosting yet). If spam appears, add rate limiting at the hosting
  level or via a small store; recorded as a deferral.

## Privacy and legal

- New personal data: name, e-mail, phone, note. Purpose: handling the reservation and, within the
  retention month, recognising frequent guests. Legal basis to be stated in the privacy policy
  (pre-contractual measures; legitimate interest for the frequent-guest view) – to be checked
  before launch.
- The privacy policy placeholder gets a "Reservations" section; `docs/legal-checklist.md` gets
  items for the reservation data, retention, Resend as processor (data processing agreement,
  EU/US transfer) and the e-mail sender domain.
- Notes may contain health information (allergies). The form hint says to mention allergies only
  if needed; the data is deleted with the rest after one month.

## Testing

- Unit (`reservation-rules`): split shifts, last booking 60 min before close, lead time 1 h,
  horizon 60 days, closed weekday, closed exception, special-hours exception, party size limits,
  DST day.
- Integration (Payload, throwaway DB): the public cannot read or create reservations via the API;
  the server function rejects invalid requests and stores valid ones; status change sends the
  right mail (captured by a test e-mail adapter); duplicate request ignored; cleanup empties
  personal fields only for reservations older than the retention period.
- Browser check at 1280 px and 375 px: form, errors, success panel, mobile bar with four items.

## Out of scope

Table plans and capacity, automatic confirmation, deposits or payments, cancellation links for
guests, reminders, calendar files, guest accounts, external provider APIs.

## Configuration

New env values (fake placeholders in `.env.example`): `RESEND_API_KEY`, `EMAIL_FROM`,
`CRON_SECRET`. Without `RESEND_API_KEY` mails are written to the server log. The daily cleanup is
scheduled once hosting is chosen (e.g. Vercel Cron); until then `pnpm reservations:cleanup`.
