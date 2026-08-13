import { defineConfig } from 'rolldown';
import placeholdersPlugin from "./rolldown_plugins/placeholders/placeholders.js";
// import nodePolyfills from '@rolldown/plugin-node-polyfills';

export default defineConfig({
    input: 'mopidy_eboplayer/www/typescript/gui.ts',
    output: {
        file: 'mopidy_eboplayer/www/generated/bundle.js',
        sourcemap: true,
    },
    plugins: [
        // nodePolyfills()
        placeholdersPlugin()
    ],
    external: [
        "events",
        "mopidy"
    ]
});