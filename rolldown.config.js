import { defineConfig } from 'rolldown';
// import nodePolyfills from '@rolldown/plugin-node-polyfills';

export default defineConfig({
    input: 'typescript/gui.ts',
    output: {
        file: 'mopidy_eboplayer/static/generated/bundle.js',
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