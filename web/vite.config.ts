import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 浏览器直连 api.deepseek.com 会被 CORS 拦截，走 dev server 代理
      '/api/deepseek': {
        target: 'https://api.deepseek.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/deepseek/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            // 流式响应：避免代理缓冲
            proxyReq.setHeader('Accept-Encoding', 'identity')
          })
        },
      },
    },
  },
})
