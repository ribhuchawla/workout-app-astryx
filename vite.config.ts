import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Workaround for @astryxdesign/core v0.1.5 bug: several components
      // (Token, Tooltip, SideNav, Pagination, etc.) import `jsxDEV` from
      // 'react/jsx-dev-runtime' in their published dist, which is meant for
      // local dev only and breaks production builds ("jsxDEV is not a
      // function"). Alias it to a local shim built on the real prod
      // jsx-runtime. Remove this once Astryx ships a fixed release.
      'react/jsx-dev-runtime': path.resolve(__dirname, 'src/shims/jsx-dev-runtime-shim.js'),
    },
  },
})
