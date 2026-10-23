/*
 * Append-only audit log of every decision, one JSON line per arrival, so an
 * operator (or a judge) can see what was decided, by whom, and how sure.
 */
import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { AuditEntry } from '../src/control/types.ts'

export const AUDIT_PATH = join(import.meta.dirname, 'data', 'audit.jsonl')

export async function appendAudit(entry: AuditEntry, path = AUDIT_PATH): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await appendFile(path, JSON.stringify(entry) + '\n')
}

/** The last `limit` entries, oldest first. A missing log is an empty log. */
export async function readAudit(limit = 50, path = AUDIT_PATH): Promise<AuditEntry[]> {
  if (limit <= 0) return []
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  const lines = text.split('\n').filter(Boolean).slice(-limit)
  const out: AuditEntry[] = []
  for (const line of lines) {
    try {
      out.push(JSON.parse(line) as AuditEntry)
    } catch {
      // a line torn by a crash mid-write is skipped, not fatal
    }
  }
  return out
}
