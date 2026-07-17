import { defineConfig } from 'rolldown';
// import nodePolyfills from '@rolldown/plugin-node-polyfills';

export default defineConfig({
    input: 'mopidy_eboplayer/www/typescript/gui.ts',
    output: {
        file: 'mopidy_eboplayer/www/generated/bundle.js',
        sourcemap: true,
    },
    plugins: [
        // nodePolyfills()
    ],
    external: [
        "events",
        "mopidy"
    ]
});