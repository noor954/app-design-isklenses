import { defineConfig } from '@neon/config/v1'

export default defineConfig({
  preview: {
    realtime: {
      allowedOrigins: ['https://isklenses.com', 'http://localhost:3000'],
    },
  },
})
