import { drizzle, type AnyD1Database } from 'drizzle-orm/d1'
import * as schema from './schema.d1'

export function createD1Database(binding: AnyD1Database) {
  return drizzle(binding, { schema })
}
