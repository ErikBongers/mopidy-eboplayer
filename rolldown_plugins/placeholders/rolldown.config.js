import { defineConfig } from 'rolldown';
// import nodePolyfills from '@rolldown/plugin-node-polyfills';

export default defineConfig({
    platform: 'node',
    input: './main.ts',
    output: {
        file: './main.cjs',
        sourcemap: true,
        format: 'cjs',
    }
});