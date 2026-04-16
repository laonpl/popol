import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['pptxgenjs'],
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // React 코어
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Firebase
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          // 상태관리
          'vendor-zustand': ['zustand'],
          // UI 라이브러리
          'vendor-ui': ['lucide-react', 'react-hot-toast'],
          // Yoopta 에디터
          'vendor-yoopta': [
            '@yoopta/editor', '@yoopta/paragraph', '@yoopta/headings',
            '@yoopta/lists', '@yoopta/blockquote', '@yoopta/link',
            '@yoopta/marks', '@yoopta/ui',
          ],
          // Slate (Yoopta 의존)
          'vendor-slate': ['slate', 'slate-react', 'slate-dom'],
        },
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  }
})
