import 'server-only'

import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { storeErrorLogs } from '@/lib/db/schema'

export async function logApplicationError(input: {
  source: string
  errorName: string
  message: string
  stack?: string | null
}) {
  const redact = (value: string) => value
    .replace(
      /\b(password|token|secret|authorization|cookie|api[-_ ]?key)\b(\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
      '$1$2[REDACTED]',
    )
    .replace(/([?&][^\s&#=]+)=([^&#\s]*)/g, '$1=[REDACTED]')
  await db.delete(storeErrorLogs).where(sql`${storeErrorLogs.createdAt} < now() - interval '1 day'`)
  await db.insert(storeErrorLogs).values({
    source: redact(input.source).slice(0, 120),
    errorName: redact(input.errorName).slice(0, 200),
    message: redact(input.message).slice(0, 4000),
    stack: input.stack ? redact(input.stack).slice(0, 12000) : null,
  })
}
