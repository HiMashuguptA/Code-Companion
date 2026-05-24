import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCKkMvvW0T4B2Dk631D2PyVeiKAmv864xA",
  authDomain: "gupta-enterprises-98e81.firebaseapp.com",
  projectId: "gupta-enterprises-98e81",
  storageBucket: "gupta-enterprises-98e81.firebasestorage.app",
  messagingSenderId: "4113226514",
  appId: "1:4113226514:web:0f8d62e437bbfa928931cb",
  measurementId: "G-PLNX25ZRWZ",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]!;
export const auth = getAuth(app);
export default app;
