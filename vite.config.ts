import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/delta-assessments/',
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react-runtime', test: /node_modules[\\/]react(?:[-/\\]|$)/ },
            { name: 'storage-runtime', test: /node_modules[\\/](?:dexie|zod)[\\/]/ },
          ],
        },
      },
    },
  },
})
