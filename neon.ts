import { defineConfig } from '@neon/config/v1'

export default defineConfig({
  preview: {
    realtime: {
      allowedOrigins: ['https://www.isklenses.online'],
    },
  },
})
