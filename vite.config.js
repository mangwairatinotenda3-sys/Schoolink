import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base ('./') so the built assets resolve correctly no matter
// what the GitHub Pages project path is (https://<user>.github.io/<repo>/).
export default defineConfig({
  plugins: [react()],
  base: './',
})
