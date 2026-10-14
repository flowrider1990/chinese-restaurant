import { describe, expect, it } from 'vitest'
import { assertTestKey } from '@/lib/stripe'

describe('assertTestKey', () => {
  it('accepts a test key', () => {
    expect(assertTestKey('sk_test_abc')).toBe('sk_test_abc')
  })
  it('refuses a missing key', () => {
    expect(() => assertTestKey(undefined)).toThrow(/STRIPE_SECRET_KEY/)
    expect(() => assertTestKey('')).toThrow(/STRIPE_SECRET_KEY/)
  })
  it('refuses live and restricted keys', () => {
    expect(() => assertTestKey('sk_live_abc')).toThrow(/test/)
    expect(() => assertTestKey('rk_live_abc')).toThrow(/test/)
  })
})
