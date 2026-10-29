import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import type { BuildInfo } from "@mgcrea/vite-plugin-build-info";

declare global {
    const __BUILD_INFO__: BuildInfo;
}

const app = mount(App, {
    target: document.querySelector('body')!,
})

export { app }
