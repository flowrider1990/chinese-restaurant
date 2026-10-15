import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'unit', environment: 'node', include: ['tests/unit/**/*.test.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'int',
          environment: 'node',
          include: ['tests/int/**/*.int.spec.ts'],
          globalSetup: ['./tests/int/global-setup.ts'],
          setupFiles: ['./vitest.setup.ts'],
          // Overrides .env so tests never touch the dev or Turso database, the Blob store or send
          // real e-mails.
          env: {
            DATABASE_URL: 'file:./data/test.db',
            DATABASE_AUTH_TOKEN: '',
            RESEND_API_KEY: '',
            BLOB_READ_WRITE_TOKEN: '',
          },
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
})
