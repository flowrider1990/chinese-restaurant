'use client'

import Link from 'next/link'
import { useActionState, useMemo, useState, useSyncExternalStore } from 'react'
import { dictionaries } from '@/i18n/dictionary'
import type { Locale } from '@/i18n/locales'
import type { Hours } from '@/lib/opening-hours'
import { availableTimes, bookableRange, type ReservationRules } from '@/lib/reservation-rules'
import type { SubmitResult } from '@/lib/reservation-submit'
import { requestReservationAction } from './actions'

const noop = () => () => {}

type Props = {
  locale: Locale
  hours: Hours
  rules: ReservationRules
  phone: string
  privacyHref: string
}

export function ReservationForm({ locale, hours, rules, phone, privacyHref }: Props) {
  const t = dictionaries[locale].reserve
  const [state, action, pending] = useActionState<SubmitResult | null, FormData>(
    requestReservationAction,
    null,
  )
  // "Now" only exists in the browser; render the date/time inputs after hydration.
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  )
  const [date, setDate] = useState('')
  // Controlled fields: React resets uncontrolled form fields after an action, which would wipe
  // what the guest typed when the server returns errors.
  const [values, setValues] = useState({
    time: '',
    partySize: '2',
    name: '',
    email: '',
    phone: '',
    note: '',
  })
  const [privacy, setPrivacy] = useState(false)
  const bind = (field: keyof typeof values) => ({
    value: values[field],
    onChange: (e: { target: { value: string } }) =>
      setValues((v) => ({ ...v, [field]: e.target.value })),
  })
  const range = useMemo(
    () => (mounted ? bookableRange(rules, new Date(), hours.timezone ?? undefined) : null),
    [mounted, rules, hours],
  )
  const times = useMemo(
    () => (mounted && date ? availableTimes(hours, rules, date, new Date()) : []),
    [mounted, date, hours, rules],
  )

  if (state?.ok) {
    const details = `${new Intl.DateTimeFormat(locale === 'de' ? 'de-DE' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${state.date}T12:00:00Z`))}, ${state.time} · ${t.people(state.partySize)}`
    return (
      <section className="reserve-success" role="status">
        <h2>{t.successTitle}</h2>
        <p>{t.success(details)}</p>
      </section>
    )
  }

  const problems = state && !state.ok ? state.problems : {}
  const err = (field: keyof typeof problems) =>
    problems[field] ? (
      <p className="field__error" id={`${field}-error`}>
        {t.problems[problems[field]!]}
      </p>
    ) : null
  const described = (field: keyof typeof problems) =>
    problems[field] ? `${field}-error` : undefined

  return (
    <form action={action} className="reserve-form" noValidate>
      {state && !state.ok && (
        <p className="reserve-form__summary" role="alert">
          {state.closed ? t.closed : t.errorSummary}
        </p>
      )}
      <input type="hidden" name="locale" value={locale} />
      {/* Honeypot: hidden from people and screen readers; bots fill it in. */}
      <div className="reserve-form__hp" aria-hidden="true">
        <label>
          Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="field field--third">
        <label htmlFor="date">{t.date}</label>
        <input
          id="date"
          name="date"
          type="date"
          required
          min={range?.min}
          max={range?.max}
          value={date}
          onChange={(e) => {
            setDate(e.target.value)
            setValues((v) => ({ ...v, time: '' }))
          }}
          aria-invalid={Boolean(problems.date)}
          aria-describedby={described('date')}
        />
        {err('date')}
      </div>
      <div className="field field--third">
        <label htmlFor="time">{t.time}</label>
        <select
          id="time"
          name="time"
          required
          disabled={!date || times.length === 0}
          aria-invalid={Boolean(problems.time)}
          aria-describedby={described('time')}
          {...bind('time')}
        >
          <option value="" disabled>
            {t.chooseTime}
          </option>
          {times.map((time) => (
            <option key={time} value={time}>
              {time}
            </option>
          ))}
        </select>
        {date && times.length === 0 && <p className="field__hint">{t.noTimes}</p>}
        {err('time')}
      </div>
      <div className="field field--third field--party">
        <label htmlFor="partySize">{t.partySize}</label>
        <select
          id="partySize"
          name="partySize"
          {...bind('partySize')}
          aria-invalid={Boolean(problems.partySize)}
          aria-describedby={['party-hint', described('partySize')].filter(Boolean).join(' ')}
        >
          {Array.from({ length: rules.maxPartySize }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <p className="field__hint" id="party-hint">
          {t.largeGroup(rules.maxPartySize, phone)}
        </p>
        {err('partySize')}
      </div>

      <div className="field field--half">
        <label htmlFor="name">{t.name}</label>
        <input
          id="name"
          name="name"
          {...bind('name')}
          type="text"
          required
          maxLength={100}
          autoComplete="name"
          aria-invalid={Boolean(problems.name)}
          aria-describedby={described('name')}
        />
        {err('name')}
      </div>
      <div className="field field--half">
        <label htmlFor="email">{t.email}</label>
        <input
          id="email"
          name="email"
          {...bind('email')}
          type="email"
          required
          maxLength={200}
          autoComplete="email"
          aria-invalid={Boolean(problems.email)}
          aria-describedby={described('email')}
        />
        {err('email')}
      </div>
      <div className="field field--half">
        <label htmlFor="phone">{t.phone}</label>
        <input
          id="phone"
          name="phone"
          {...bind('phone')}
          type="tel"
          maxLength={40}
          autoComplete="tel"
          aria-invalid={Boolean(problems.phone)}
          aria-describedby={['phone-hint', described('phone')].filter(Boolean).join(' ')}
        />
        <p className="field__hint" id="phone-hint">
          {t.phoneHint}
        </p>
        {err('phone')}
      </div>

      <div className="field">
        <label htmlFor="note">{t.note}</label>
        <textarea
          id="note"
          name="note"
          {...bind('note')}
          maxLength={500}
          rows={3}
          aria-describedby="note-hint"
          aria-invalid={Boolean(problems.note)}
        />
        <p className="field__hint" id="note-hint">
          {t.noteHint}
        </p>
        {err('note')}
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
          aria-describedby={described('privacy')}
        />
        <label htmlFor="privacy">
          {t.privacy}{' '}
          <Link href={privacyHref} target="_blank">
            {t.privacyLink}
          </Link>
        </label>
        {err('privacy')}
      </div>

      <button type="submit" className="btn btn--primary" disabled={pending}>
        {pending ? t.sending : t.submit}
      </button>
    </form>
  )
}
