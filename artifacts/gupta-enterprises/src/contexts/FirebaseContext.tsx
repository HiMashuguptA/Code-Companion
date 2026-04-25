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
import { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo, type ReactNode } from "react";
import { useRegisterUser, useGetProfile, setAuthTokenGetter, getGetProfileQueryKey } from "@workspace/api-client-react";

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
  if (user) return await user.getIdToken();
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
  refetchProfile: () => Promise<void>;
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
  const hasRegisteredRef = useRef<boolean>(false);
  const authListenerSetupRef = useRef<boolean>(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const { data: dbUser, refetch: rawRefetchProfile } = useGetProfile({
    query: {
      queryKey: getGetProfileQueryKey(),
      enabled: !!currentUser,
      retry: false,
      staleTime: 10 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchInterval: undefined,
    }
  });

  const registerMutation = useRegisterUser();

  // Stable refetch function that doesn't cause re-renders
  const lastRefetchRef = useRef<number>(0);
  const refetchProfile = useCallback(async () => {
    const now = Date.now();
    // Prevent refetching more than once per second
    if (now - lastRefetchRef.current < 1000) {
      console.log("⏱️ Skipping refetch, already fetched recently");
      return;
    }
    lastRefetchRef.current = now;
    
    try {
      console.log("🔄 Refetching profile...");
      await rawRefetchProfile();
      console.log("✅ Profile refetch complete");
    } catch (err) {
      console.error("❌ Failed to refetch profile:", err);
    }
  }, [rawRefetchProfile]);

  // ONLY register user on auth state change - NO automatic refetch
  // Use a ref to handle the mutation to avoid dependency issues
  const registerMutationRef = useRef(registerMutation);
  useEffect(() => {
    // Update the ref whenever registerMutation changes, but don't trigger the auth listener
    registerMutationRef.current = registerMutation;
  }, [registerMutation]);

  useEffect(() => {
    // Guard against strict mode double-running or multiple setup attempts
    if (authListenerSetupRef.current) {
      console.log("⚠️ Auth listener already set up, skipping");
      return;
    }
    authListenerSetupRef.current = true;

    console.log("🔧 Setting up auth listener");
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("🔐 Auth state changed:", user?.email ?? "logged out");
      setCurrentUser(user);
      setIsLoading(false);

      if (!user) {
        // User logged out
        hasRegisteredRef.current = false;
        return;
      }

      if (user && !hasRegisteredRef.current) {
        hasRegisteredRef.current = true;
        try {
          const result = await registerMutationRef.current.mutateAsync({
            data: {
              firebaseUid: user.uid,
              email: user.email || `${user.phoneNumber}@phone.auth`,
              name: user.displayName || undefined,
              phone: user.phoneNumber || undefined,
              photoUrl: user.photoURL || undefined
            }
          });
          console.log("✅ User registered successfully:", user.uid, "Role:", (result as any)?.role);
          // Refetch profile to get latest role
          await rawRefetchProfile();
        } catch (err) {
          console.error("❌ Failed to register user:", err);
        }
      }
    });

    unsubscribeRef.current = unsubscribe;

    // Cleanup: unsubscribe from auth state listener
    return () => {
      console.log("🧹 Cleaning up auth listener");
      unsubscribe();
      unsubscribeRef.current = null;
      authListenerSetupRef.current = false;
    };
  }, []); // Empty dependency array - only run once on mount

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }, []);

  const signInWithEmailPassword = useCallback(async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  }, []);

  const signUpWithEmail = useCallback(async (email: string, pass: string, _name: string) => {
    await createUserWithEmailAndPassword(auth, email, pass);
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  const setupRecaptcha = useCallback((containerId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (!w.recaptchaVerifier) {
      w.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, { size: "invisible" });
    }
  }, []);

  const sendPhoneOTP = useCallback(async (phone: string): Promise<ConfirmationResult> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    return signInWithPhoneNumber(auth, phone, w.recaptchaVerifier as RecaptchaVerifier);
  }, []);

  const contextValue = useMemo(() => ({
    currentUser,
    dbUser: dbUser as DbUser | null,
    isLoading,
    refetchProfile,
    signInWithGoogle,
    signInWithEmailPassword,
    signUpWithEmail,
    signOut,
    setupRecaptcha,
    sendPhoneOTP
  }), [currentUser, dbUser, isLoading, refetchProfile, signInWithGoogle, signInWithEmailPassword, signUpWithEmail, signOut, setupRecaptcha, sendPhoneOTP]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
