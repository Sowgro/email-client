import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { buildInfo } from '@mgcrea/vite-plugin-build-info';

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte(), viteSingleFile(), buildInfo()],
})
