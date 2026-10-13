'use client'

import type { NumberFieldClientComponent } from 'payload'
import { FieldError, TextInput, useField } from '@payloadcms/ui'
import { type ChangeEvent, useState } from 'react'
import { centsToInput, parsePriceInput } from '@/lib/price'

/** Shows/edits cents as a euro amount ("12,90"). Invalid text is passed through so validation flags it. */
export const PriceField: NumberFieldClientComponent = ({ field, path }) => {
  const { value, setValue, showError, disabled } = useField<number | string | null>({ path })
  const [typed, setTyped] = useState<string | null>(null)

  // Show what the editor typed while it still matches the form value; otherwise (load, reset,
  // another document) show the stored value formatted.
  const matchesValue =
    typed !== null && (typed === value || parsePriceInput(typed) === (value ?? null))
  const text = matchesValue ? typed : typeof value === 'number' ? centsToInput(value) : ''
  const unparseable = text.trim() !== '' && parsePriceInput(text) === null

  return (
    <TextInput
      path={path}
      label={field.label}
      required={field.required}
      readOnly={disabled || field.admin?.readOnly}
      description={field.admin?.description}
      placeholder="12,90"
      value={text}
      showError={showError || unparseable}
      Error={
        unparseable ? (
          <FieldError path={path} message="Ungültiger Betrag. Format: 12,90" showError />
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
