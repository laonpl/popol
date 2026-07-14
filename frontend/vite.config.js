import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    modulePreload: {
      resolveDependencies(filename, deps, { hostType }) {
        if (hostType === 'html') {
          return deps.filter(dep => !/vendor-(yoopta|slate)/.test(dep));
        }
        return deps;
      },
    },
    rollupOptions: {
      output: {
        // 벤더 코드를 안정적인 청크로 분리 — 앱 코드가 바뀌어도 벤더 청크 캐시가 유지되도록.
        // 특히 @yoopta/code(내장 shiki+prettier, 단일 12MB 파일)는 반드시 별도 청크로 두어
        // 에디터 코드 수정 시 사용자가 매번 재다운로드하지 않게 한다.
        manualChunks(id) {
          // node_modules 경로에서 패키지명만 정확히 추출 (파일명 부분 매칭 오류 방지 —
          // 예: recharts의 "translate*.js"가 includes('slate')에 걸리면 순환 청크가 생긴다)
          const m = id.replace(/\\/g, '/').match(/node_modules\/((?:@[^/]+\/)?[^/]+)/);
          if (!m) return undefined;
          const pkg = m[1];
          if (pkg === '@yoopta/code') return 'vendor-yoopta-code';
          if (pkg === '@yoopta/themes-shadcn') return 'vendor-yoopta-theme';
          if (pkg.startsWith('@yoopta/')) return 'vendor-yoopta';
          if (pkg === 'slate' || pkg.startsWith('slate-')) return 'vendor-slate';
          if (pkg === 'react' || pkg === 'react-dom' || pkg === 'scheduler' || pkg.startsWith('react-router')) return 'vendor-react';
          if (pkg === 'firebase' || pkg.startsWith('@firebase/')) return 'vendor-firebase';
          if (pkg === 'zustand') return 'vendor-zustand';
          if (pkg === 'lucide-react' || pkg === 'react-hot-toast') return 'vendor-ui';
          if (pkg === 'recharts' || pkg.startsWith('d3-') || pkg === 'victory-vendor' || pkg === 'internmap') return 'vendor-charts';
          if (pkg === 'pptxgenjs') return 'vendor-pptxgen';
          return undefined;
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
