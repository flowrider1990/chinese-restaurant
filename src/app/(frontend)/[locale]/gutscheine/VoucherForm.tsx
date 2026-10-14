'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { dictionaries } from '@/i18n/dictionary'
import type { Locale } from '@/i18n/locales'
import type { CheckoutResult } from '@/lib/voucher-checkout'
import { VOUCHER_LIMITS } from '@/lib/voucher-rules'
import { buyVoucherAction } from './actions'

export function VoucherForm({ locale, privacyHref }: { locale: Locale; privacyHref: string }) {
  const t = dictionaries[locale].vouchers
  const [state, action, pending] = useActionState<CheckoutResult | null, FormData>(
    buyVoucherAction,
    null,
  )
  // Controlled fields: React resets uncontrolled form fields after an action, which would wipe
  // what the buyer typed when the server returns errors.
  const [values, setValues] = useState({
    amount: '50',
    customAmount: '',
    buyerName: '',
    buyerEmail: '',
    recipientName: '',
    message: '',
  })
  const [privacy, setPrivacy] = useState(false)
  const bind = (field: keyof typeof values) => ({
    value: values[field],
    onChange: (e: { target: { value: string } }) =>
      setValues((v) => ({ ...v, [field]: e.target.value })),
  })
  const problems = state && !state.ok ? state.problems : {}
  const err = (field: keyof typeof problems) =>
    problems[field] ? (
      <p className="field__error" id={`${field}-error`}>
        {t.problems[problems[field]!]}
      </p>
    ) : null
  const described = (...ids: (string | false | undefined)[]) =>
    ids.filter(Boolean).join(' ') || undefined
  const euro = new Intl.NumberFormat(locale === 'de' ? 'de-DE' : 'en-GB', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  })

  return (
    <form action={action} className="reserve-form voucher-form" noValidate>
      {state && !state.ok && (state.unavailable || Object.keys(state.problems).length > 0) && (
        <p className="reserve-form__summary" role="alert">
          {state.unavailable ? t.unavailable : t.errorSummary}
        </p>
      )}
      <input type="hidden" name="locale" value={locale} />
      {/* Honeypot: hidden from people and screen readers; bots fill it in. */}
      <div className="reserve-form__hp" aria-hidden="true">
        <label>
          Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <fieldset
        className="field amount-picks"
        aria-describedby={described(problems.amount && 'amount-error')}
      >
        <legend>{t.amount}</legend>
        <div className="amount-picks__options">
          {[...VOUCHER_LIMITS.presets.map(String), 'other'].map((value) => (
            <label key={value} className="amount-pick">
              <input
                type="radio"
                name="amount"
                value={value}
                checked={values.amount === value}
                onChange={bind('amount').onChange}
              />
              <span>{value === 'other' ? t.other : euro.format(Number(value))}</span>
            </label>
          ))}
        </div>
        {values.amount === 'other' && (
          <div className="amount-picks__custom">
            <label htmlFor="customAmount">{t.otherLabel}</label>
            <input
              id="customAmount"
              name="customAmount"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              {...bind('customAmount')}
              aria-invalid={Boolean(problems.amount)}
              aria-describedby={described('custom-hint', problems.amount && 'amount-error')}
            />
            <p className="field__hint" id="custom-hint">
              {t.otherHint(VOUCHER_LIMITS.min, VOUCHER_LIMITS.max)}
            </p>
          </div>
        )}
        {err('amount')}
      </fieldset>

      <div className="field field--half">
        <label htmlFor="buyerName">{t.buyerName}</label>
        <input
          id="buyerName"
          name="buyerName"
          type="text"
          required
          maxLength={VOUCHER_LIMITS.buyerName}
          autoComplete="name"
          {...bind('buyerName')}
          aria-invalid={Boolean(problems.buyerName)}
          aria-describedby={described(problems.buyerName && 'buyerName-error')}
        />
        {err('buyerName')}
      </div>
      <div className="field field--half">
        <label htmlFor="buyerEmail">{t.buyerEmail}</label>
        <input
          id="buyerEmail"
          name="buyerEmail"
          type="email"
          required
          maxLength={VOUCHER_LIMITS.email}
          autoComplete="email"
          {...bind('buyerEmail')}
          aria-invalid={Boolean(problems.buyerEmail)}
          aria-describedby={described('email-hint', problems.buyerEmail && 'buyerEmail-error')}
        />
        <p className="field__hint" id="email-hint">
          {t.emailHint}
        </p>
        {err('buyerEmail')}
      </div>
      <div className="field field--half">
        <label htmlFor="recipientName">{t.recipientName}</label>
        <input
          id="recipientName"
          name="recipientName"
          type="text"
          maxLength={VOUCHER_LIMITS.recipientName}
          {...bind('recipientName')}
          aria-invalid={Boolean(problems.recipientName)}
          aria-describedby={described(
            'recipient-hint',
            problems.recipientName && 'recipientName-error',
          )}
        />
        <p className="field__hint" id="recipient-hint">
          {t.recipientHint}
        </p>
        {err('recipientName')}
      </div>
      <div className="field">
        <label htmlFor="message">{t.message}</label>
        <textarea
          id="message"
          name="message"
          rows={3}
          maxLength={VOUCHER_LIMITS.message}
          {...bind('message')}
          aria-invalid={Boolean(problems.message)}
          aria-describedby={described('message-hint', problems.message && 'message-error')}
        />
        <p className="field__hint" id="message-hint">
          {t.messageHint(VOUCHER_LIMITS.message)}
        </p>
        {err('message')}
      </div>

      <div className="field field--check">
        <input
          id="privacy"
          name="privacy"
          type="checkbox"
          checked={privacy}
          onChange={(e) => setPrivacy(e.target.checked)}
          required
          aria-invalid={Boolean(problems.privacy)}
          aria-describedby={described(problems.privacy && 'privacy-error')}
        />
        <label htmlFor="privacy">
          {t.privacy}{' '}
          <Link href={privacyHref} target="_blank">
            {t.privacyLink}
          </Link>
        </label>
        {err('privacy')}
      </div>

      <p className="voucher-form__demo">{t.demo}</p>
      <button type="submit" className="btn btn--primary" disabled={pending}>
        {pending ? t.sending : t.submit}
      </button>
    </form>
  )
}
