import { defineConfig } from 'rolldown';

export default defineConfig({
    input: 'mopidy_eboplayer/www/typescript/serviceWorker.ts',
    output: {
        file: 'mopidy_eboplayer/www/generated/serviceWorker.js',
        sourcemap: true,
    },
    tsconfig: "./tsconfig_webworker.json",
    plugins: [
    ],
    external: [
        "events",
    ]
});