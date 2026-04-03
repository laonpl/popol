import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyApjdYm6oHkz_DZB-f6ieANLnutvWbWnSw",
  authDomain: "popol-cb20b.firebaseapp.com",
  projectId: "popol-cb20b",
  storageBucket: "popol-cb20b.firebasestorage.app",
  messagingSenderId: "19993372358",
  appId: "1:19993372358:web:8ee68f2f1fda2dc5ee19c7",
  measurementId: "G-3Y8N480R2H"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
