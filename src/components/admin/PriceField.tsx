'use client'

import type { NumberFieldClientComponent } from 'payload'
import { TextInput, useField } from '@payloadcms/ui'
import { type ChangeEvent, useState } from 'react'
import { centsToInput, parsePriceInput } from '@/lib/price'

/** Shows/edits cents as a euro amount ("12,90"). Invalid text is passed through so validation flags it. */
export const PriceField: NumberFieldClientComponent = ({ field, path }) => {
  const { value, setValue, showError, errorMessage, disabled } = useField<number | string | null>({
    path,
  })
  const [typed, setTyped] = useState<string | null>(null)

  // Show what the editor typed while it still matches the form value; otherwise (load, reset,
  // another document) show the stored value formatted.
  const matchesValue =
    typed !== null && (typed === value || parsePriceInput(typed) === (value ?? null))
  const text = matchesValue ? typed : typeof value === 'number' ? centsToInput(value) : ''
  const unparseable = text.trim() !== '' && parsePriceInput(text) === null
  const message = unparseable
    ? 'Ungültiger Betrag. Format: 12,90'
    : showError
      ? errorMessage
      : undefined

  return (
    <TextInput
      path={path}
      label={field.label}
      required={field.required}
      readOnly={disabled || field.admin?.readOnly}
      description={field.admin?.description}
      placeholder="12,90"
      value={text}
      showError={Boolean(message)}
      // Payload's default error is a hover tooltip; show the message as text below the input instead.
      Error={<></>}
      AfterInput={
        message ? (
          <p className="price-field__error" role="alert">
            {message}
          </p>
        ) : undefined
      }
      onChange={(e: ChangeEvent<HTMLInputElement>) => {
        const next = e.target.value
        setTyped(next)
        if (next.trim() === '') return setValue(null)
        setValue(parsePriceInput(next) ?? next)
      }}
    />
  )
}
