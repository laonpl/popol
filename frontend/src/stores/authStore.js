import { create } from 'zustand';

// 간단한 게스트 ID 생성
const guestId = () => 'guest_' + Math.random().toString(36).slice(2, 11);

const useAuthStore = create((set, get) => ({
  user: null,
  loading: false,

  init: () => {
    // localStorage에서 기존 게스트 세션 복원
    try {
      const saved = localStorage.getItem('popol_user');
      if (saved) {
        set({ user: JSON.parse(saved), loading: false });
        return;
      }
    } catch (e) { /* ignore */ }
    // 저장된 세션이 없으면 자동으로 게스트 로그인
    const user = {
      uid: guestId(),
      displayName: '사용자',
    };
    localStorage.setItem('popol_user', JSON.stringify(user));
    set({ user, loading: false });
  },

  // 게스트 로그인 (이름 입력 없이 바로)
  guestLogin: () => {
    const user = {
      uid: guestId(),
      displayName: '사용자',
    };
    localStorage.setItem('popol_user', JSON.stringify(user));
    set({ user });
  },

  updateDisplayName: (displayName) => {
    const user = get().user;
    if (!user) return;
    const updated = { ...user, displayName };
    localStorage.setItem('popol_user', JSON.stringify(updated));
    set({ user: updated });
  },

  signOut: () => {
    localStorage.removeItem('popol_user');
    set({ user: null });
  },
}));

export default useAuthStore;
