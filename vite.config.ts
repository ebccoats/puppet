import { defineConfig } from 'vite'
import wasm from 'vite-plugin-wasm'

// build.target: 'esnext' keeps Rapier's top-level await
// optimizeDeps.exclude prevents vite from pre-bundling the wasm and breaking it
export default defineConfig({
    plugins: [wasm()],
    build: {
        target: 'esnext',
    },
    optimizeDeps: {
        exclude: ['@dimforge/rapier3d'],
    },
})
