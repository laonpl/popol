import { create } from 'zustand';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

const googleProvider = new GoogleAuthProvider();

const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  profileLoading: false,

  init: () => {
    set({ loading: true });
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const user = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || '',
          photoURL: firebaseUser.photoURL || '',
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
    };
    set({ user });
    return user;
  },

  signInWithGoogle: async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    const user = {
      uid: cred.user.uid,
      email: cred.user.email,
      displayName: cred.user.displayName || '',
      photoURL: cred.user.photoURL || '',
    };
    set({ user });
    const profileSnap = await getDoc(doc(db, 'profiles', cred.user.uid));
    if (profileSnap.exists()) {
      set({ profile: profileSnap.data() });
    }
    return user;
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
