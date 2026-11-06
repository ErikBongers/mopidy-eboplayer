import { defineConfig } from 'rolldown';
import placeholdersPlugin from "./rolldown_plugins/placeholders/main.cjs";
// import nodePolyfills from '@rolldown/plugin-node-polyfills';

let version = JSON.stringify(`${Date.now()}`)
export default defineConfig({
    input: 'mopidy_eboplayer/www/typescript/gui.ts',
    output: {
        file: 'mopidy_eboplayer/www/generated/bundle.js',
        sourcemap: true,
    },
    define: {
        '__BUILD_VERSION__': version
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