import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User as FirebaseUser,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult
} from "firebase/auth";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRegisterUser, useGetProfile, setAuthTokenGetter } from "@workspace/api-client-react";

const firebaseConfig = {
  apiKey: "AIzaSyCKkMvvW0T4B2Dk631D2PyVeiKAmv864xA",
  authDomain: "gupta-enterprises-98e81.firebaseapp.com",
  projectId: "gupta-enterprises-98e81",
  storageBucket: "gupta-enterprises-98e81.firebasestorage.app",
  messagingSenderId: "4113226514",
  appId: "1:4113226514:web:0f8d62e437bbfa928931cb",
  measurementId: "G-PLNX25ZRWZ"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

setAuthTokenGetter(async () => {
  const user = auth.currentUser;
  if (user) {
    return await user.getIdToken();
  }
  return null;
});

export type DbUser = {
  id: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  photoUrl?: string | null;
  role: "USER" | "ADMIN" | "DELIVERY_AGENT";
  addresses?: unknown[];
  createdAt: string;
};

type AuthContextType = {
  currentUser: FirebaseUser | null;
  dbUser: DbUser | null;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmailPassword: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  setupRecaptcha: (containerId: string) => void;
  sendPhoneOTP: (phone: string) => Promise<ConfirmationResult>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { data: dbUser, refetch: refetchProfile } = useGetProfile({
    query: { enabled: !!currentUser, retry: false }
  });

  const registerMutation = useRegisterUser();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          await registerMutation.mutateAsync({
            data: {
              firebaseUid: user.uid,
              email: user.email || `${user.phoneNumber}@phone.auth`,
              name: user.displayName || undefined,
              phone: user.phoneNumber || undefined,
              photoUrl: user.photoURL || undefined
            }
          });
          await refetchProfile();
        } catch (_e) {
          // silent fail - user may already exist
        }
      }
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signInWithEmailPassword = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signUpWithEmail = async (email: string, pass: string, _name: string) => {
    await createUserWithEmailAndPassword(auth, email, pass);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const setupRecaptcha = (containerId: string) => {
    if (!(window as Record<string, unknown>).recaptchaVerifier) {
      (window as Record<string, unknown>).recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
        size: "invisible"
      });
    }
  };

  const sendPhoneOTP = async (phone: string) => {
    return signInWithPhoneNumber(auth, phone, (window as Record<string, unknown>).recaptchaVerifier as RecaptchaVerifier);
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      dbUser: dbUser as DbUser | null,
      isLoading,
      signInWithGoogle,
      signInWithEmailPassword,
      signUpWithEmail,
      signOut,
      setupRecaptcha,
      sendPhoneOTP
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
