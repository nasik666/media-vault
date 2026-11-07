import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// base: './' — относительные пути к ассетам. Сборка работает на
// https://<user>.github.io/<любое-имя-репо>/ без правки конфига.
// Роутера с History API нет (вкладки живут в #hash), поэтому 404.html не нужен.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  // Отметка сборки в подвале сайта: видно, что автодеплой отработал.
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __BUILD_SHA__: JSON.stringify((process.env.GITHUB_SHA ?? 'local').slice(0, 7)),
  },
});
