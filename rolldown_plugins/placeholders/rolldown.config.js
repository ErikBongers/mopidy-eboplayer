import { defineConfig } from 'rolldown';
// import nodePolyfills from '@rolldown/plugin-node-polyfills';

export default defineConfig({
    platform: 'node',
    input: './placeholders.ts',
    output: {
        file: './placeholders.cjs',
        sourcemap: true,
        format: 'cjs',
    }
});