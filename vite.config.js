import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        team: resolve(__dirname, 'team.html'),
        match: resolve(__dirname, 'match.html'),
        matches: resolve(__dirname, 'matches.html'),
        admin: resolve(__dirname, 'admin.html'),
        banpick: resolve(__dirname, 'banpick.html'),
        battle: resolve(__dirname, 'battle.html')
      }
    }
  }
});
