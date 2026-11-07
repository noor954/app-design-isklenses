import 'server-only'

import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { storeErrorLogs } from '@/lib/db/schema'
import { redactErrorLogValue } from '@/lib/errors/redact'

export async function logApplicationError(input: {
  source: string
  errorName: string
  message: string
  stack?: string | null
}) {
  await db.delete(storeErrorLogs).where(sql`${storeErrorLogs.createdAt} < now() - interval '1 day'`)
  await db.insert(storeErrorLogs).values({
    source: redactErrorLogValue(input.source).slice(0, 120),
    errorName: redactErrorLogValue(input.errorName).slice(0, 200),
    message: redactErrorLogValue(input.message).slice(0, 4000),
    stack: input.stack ? redactErrorLogValue(input.stack).slice(0, 12000) : null,
  })
}
