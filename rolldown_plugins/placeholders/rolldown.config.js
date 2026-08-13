import { defineConfig } from 'rolldown';
// import nodePolyfills from '@rolldown/plugin-node-polyfills';

export default defineConfig({
    input: './placeholders.ts',
    output: {
        file: './placeholders.js',
        sourcemap: true,
    }
});