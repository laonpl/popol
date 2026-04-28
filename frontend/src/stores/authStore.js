import { create } from 'zustand';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  getRedirectResult,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import api from '../services/api';

const googleProvider = new GoogleAuthProvider();

const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  profileLoading: false,

  init: () => {
    set({ loading: true });
    // 구글 리다이렉트 로그인 결과 처리 (onAuthStateChanged보다 먼저 실행)
    getRedirectResult(auth).catch(() => {});

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const user = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || '',
          photoURL: firebaseUser.photoURL || '',
          emailVerified: firebaseUser.emailVerified,
        };
        set({ user, loading: false });
        get().loadProfile(firebaseUser.uid);
      } else {
        set({ user: null, profile: null, loading: false });
      }
    });
    return unsubscribe;
  },

  signUpWithEmail: async (email, password, displayName) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    const user = {
      uid: cred.user.uid,
      email: cred.user.email,
      displayName,
      photoURL: '',
      emailVerified: false,
    };
    set({ user });
    return user;
  },

  signInWithEmail: async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user = {
      uid: cred.user.uid,
      email: cred.user.email,
      displayName: cred.user.displayName || '',
      photoURL: cred.user.photoURL || '',
      emailVerified: cred.user.emailVerified,
    };
    set({ user });
    return user;
  },

  signInWithGoogle: async () => {
    await signInWithPopup(auth, googleProvider);
  },

  // OTP 발송 요청
  requestOtp: async () => {
    const { data } = await api.post('/auth/request-otp');
    return data;
  },

  // OTP 검증 후 Firebase 토큰 갱신
  verifyOtp: async (otp) => {
    const { data } = await api.post('/auth/verify-otp', { otp });
    if (data.verified) {
      // Firebase 클라이언트 토큰 강제 갱신 (emailVerified: true 반영)
      await auth.currentUser?.reload();
      const refreshed = auth.currentUser;
      if (refreshed) {
        set({
          user: {
            uid: refreshed.uid,
            email: refreshed.email,
            displayName: refreshed.displayName || '',
            photoURL: refreshed.photoURL || '',
            emailVerified: true,
          },
        });
      }
    }
    return data;
  },

  loadProfile: async (uid) => {
    set({ profileLoading: true });
    try {
      const snap = await getDoc(doc(db, 'profiles', uid));
      if (snap.exists()) {
        set({ profile: snap.data(), profileLoading: false });
      } else {
        set({ profile: null, profileLoading: false });
      }
    } catch (e) {
      console.error('프로필 로드 실패:', e);
      set({ profileLoading: false });
    }
  },

  saveProfile: async (profileData) => {
    const { user } = get();
    if (!user) throw new Error('로그인이 필요합니다');
    const data = {
      ...profileData,
      uid: user.uid,
      updatedAt: new Date().toISOString(),
    };
    const ref = doc(db, 'profiles', user.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, data);
    } else {
      data.createdAt = new Date().toISOString();
      await setDoc(ref, data);
    }
    set({ profile: data });
    if (profileData.nameKo && auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName: profileData.nameKo });
      set({ user: { ...user, displayName: profileData.nameKo } });
    }
  },

  signOut: async () => {
    await firebaseSignOut(auth);
    set({ user: null, profile: null });
  },
}));

export default useAuthStore;
