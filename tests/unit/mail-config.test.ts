import { describe, expect, it } from 'vitest'
import { mailConfigProblem } from '@/lib/mail-config'

describe('mailConfigProblem', () => {
  it('flags production without a Resend key', () => {
    expect(mailConfigProblem({ NODE_ENV: 'production' })).toMatch(/RESEND_API_KEY/)
    expect(mailConfigProblem({ NODE_ENV: 'production', RESEND_API_KEY: 're_x' })).toBeNull()
    expect(mailConfigProblem({ NODE_ENV: 'development' })).toBeNull()
  })
})
