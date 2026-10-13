import { rmSync } from 'fs'

/** Integration tests run against a throwaway local libSQL file, never the dev/Turso database. */
export default function setup() {
  for (const suffix of ['', '-journal', '-wal', '-shm']) rmSync(`data/test.db${suffix}`, { force: true })
}
