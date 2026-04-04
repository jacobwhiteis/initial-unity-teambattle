import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        team: resolve(__dirname, 'team.html'),
        match: resolve(__dirname, 'match.html'),
        admin: resolve(__dirname, 'admin.html')
      }
    }
  }
});
