import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useGetProfile, setAuthTokenGetter, getGetProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

// No bearer tokens needed — session cookies handle auth
setAuthTokenGetter(null);

export type DbUser = {
  id: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  photoUrl?: string | null;
  role: "USER" | "ADMIN" | "DELIVERY_AGENT";
  addresses?: unknown[];
  superCoins?: number;
  referralCode?: string;
  createdAt: string;
};

type AuthContextType = {
  firebaseUser: FirebaseUser | null;
  /** Alias for firebaseUser — kept for backward-compat with existing components */
  currentUser: FirebaseUser | null;
  dbUser: DbUser | null;
  isLoading: boolean;
  refetchProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  setMockFirebaseUser?: (user: any) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

async function syncWithBackend(
  idToken: string,
  referralCode?: string
): Promise<void> {
  try {
    await fetch("/api/auth/firebase-callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ idToken, referralCode }),
    });
  } catch (err) {
    console.error("Failed to sync with backend:", err);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasSyncedRef = useRef(false);
  const queryClient = useQueryClient();

  const { data: dbUser, refetch: rawRefetchProfile } = useGetProfile({
    query: {
      queryKey: getGetProfileQueryKey(),
      enabled: !!firebaseUser,
      retry: false,
      staleTime: 10 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchInterval: undefined,
    },
  });

  const lastRefetchRef = useRef<number>(0);
  const refetchProfile = useCallback(async () => {
    const now = Date.now();
    if (now - lastRefetchRef.current < 1000) return;
    lastRefetchRef.current = now;
    try {
      await rawRefetchProfile();
    } catch (err) {
      console.error("Failed to refetch profile:", err);
    }
  }, [rawRefetchProfile]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (user && !hasSyncedRef.current) {
        hasSyncedRef.current = true;
        try {
          const idToken = await user.getIdToken();
          const params = new URLSearchParams(window.location.search);
          const ref = params.get("ref") ?? undefined;
          await syncWithBackend(idToken, ref);
          await rawRefetchProfile();
        } catch (err) {
          console.error("Failed to sync firebase user:", err);
        }
      }

      if (!user) {
        hasSyncedRef.current = false;
        queryClient.removeQueries({ queryKey: getGetProfileQueryKey() });
      }

      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setMockFirebaseUser = useCallback(async (user: any) => {
    setFirebaseUser(user);
    if (user) {
      hasSyncedRef.current = true;
      try {
        const idToken = await user.getIdToken();
        const params = new URLSearchParams(window.location.search);
        const ref = params.get("ref") ?? undefined;
        await syncWithBackend(idToken, ref);
        await rawRefetchProfile();
      } catch (err) {
        console.error("Failed to sync mock user:", err);
      }
    } else {
      hasSyncedRef.current = false;
      queryClient.removeQueries({ queryKey: getGetProfileQueryKey() });
    }
  }, [rawRefetchProfile, queryClient]);

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // ignore
    }
    hasSyncedRef.current = false;
    queryClient.removeQueries({ queryKey: getGetProfileQueryKey() });
    try {
      await firebaseSignOut(auth);
    } catch {
      // ignore
    }
    window.location.href = "/";
  }, [queryClient]);

  const contextValue = useMemo(
    () => ({
      firebaseUser,
      currentUser: firebaseUser,
      dbUser: dbUser as DbUser | null,
      isLoading,
      refetchProfile,
      signOut,
      setMockFirebaseUser,
    }),
    [firebaseUser, dbUser, isLoading, refetchProfile, signOut, setMockFirebaseUser]
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
