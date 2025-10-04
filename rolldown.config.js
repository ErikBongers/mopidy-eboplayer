import { defineConfig } from 'rolldown';

export default defineConfig({
    input: 'typescript/gui.ts',
    output: {
        file: 'mopidy_eboplayer/static/generated/bundle.js',
    },
});