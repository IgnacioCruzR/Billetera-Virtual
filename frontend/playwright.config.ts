import { defineConfig } from '@playwright/test'

const port = 4174
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './tests',
  workers: 1,
  use: {
    baseURL,
    channel: process.env.PLAYWRIGHT_CHANNEL,
    viewport: { width: 1440, height: 960 },
    contextOptions: { reducedMotion: 'reduce' },
  },
  webServer: {
    command: `node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
  },
})
