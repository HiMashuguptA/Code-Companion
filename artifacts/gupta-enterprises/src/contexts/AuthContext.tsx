import { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo, type ReactNode } from "react";
import { useGetProfile, setAuthTokenGetter, getGetProfileQueryKey } from "@workspace/api-client-react";

// No bearer tokens needed — we use session cookies
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
  createdAt: string;
};

type ReplitUser = {
  id: string;
  name: string;
  email?: string;
  profileImage?: string;
};

type AuthContextType = {
  currentUser: ReplitUser | null;
  dbUser: DbUser | null;
  isLoading: boolean;
  refetchProfile: () => Promise<void>;
  signIn: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

async function fetchReplitUser(): Promise<ReplitUser | null> {
  try {
    const res = await fetch("/__replauthuser");
    if (!res.ok) return null;
    const data = await res.json() as { id?: string; name?: string; email?: string; profileImage?: string };
    if (!data.id) return null;
    return { id: data.id, name: data.name ?? data.id, email: data.email, profileImage: data.profileImage };
  } catch {
    return null;
  }
}

async function syncWithBackend(replitUser: ReplitUser, referralCode?: string): Promise<void> {
  try {
    await fetch("/api/auth/replit-callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        replitUserId: replitUser.id,
        name: replitUser.name,
        email: replitUser.email,
        photoUrl: replitUser.profileImage,
        referralCode,
      }),
    });
  } catch (err) {
    console.error("Failed to sync with backend:", err);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<ReplitUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasSyncedRef = useRef(false);

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
    let cancelled = false;

    async function init() {
      const user = await fetchReplitUser();
      if (cancelled) return;

      setCurrentUser(user);

      if (user && !hasSyncedRef.current) {
        hasSyncedRef.current = true;
        // Check for referral code in URL
        const params = new URLSearchParams(window.location.search);
        const ref = params.get("ref") ?? undefined;
        await syncWithBackend(user, ref);
        await rawRefetchProfile();
      }

      setIsLoading(false);
    }

    init();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = useCallback(() => {
    window.location.href = "/api/auth/replit-login";
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // ignore
    }
    hasSyncedRef.current = false;
    setCurrentUser(null);
    window.location.href = "/";
  }, []);

  const contextValue = useMemo(() => ({
    currentUser,
    dbUser: dbUser as DbUser | null,
    isLoading,
    refetchProfile,
    signIn,
    signOut,
  }), [currentUser, dbUser, isLoading, refetchProfile, signIn, signOut]);

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
