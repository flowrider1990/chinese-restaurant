/**
 * Without a Resend key, Payload only writes mails to the log. That is fine in development; in
 * production every guest would wait for a mail that never comes.
 */
export function mailConfigProblem(env: Record<string, string | undefined>): string | null {
  if (env.NODE_ENV === 'production' && !env.RESEND_API_KEY)
    return 'RESEND_API_KEY is not set: reservation e-mails are only written to the log and never reach guests or the restaurant.'
  return null
}
