import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export function AuthPage() {
  const [, navigate] = useLocation();
  const { currentUser, signIn, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && currentUser) navigate("/");
  }, [currentUser, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#2874F0]/8 via-background to-amber-50/30 dark:to-amber-950/10 px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[#2874F0] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#2874F0]/30">
            <span className="text-2xl font-bold text-white">G</span>
          </div>
          <h1 className="text-2xl font-bold">Gupta Enterprises</h1>
          <p className="text-muted-foreground mt-1 text-sm">Your favourite stationery store in Kohima</p>
        </div>

        <div className="bg-card border rounded-2xl shadow-sm p-6 flex flex-col items-center gap-4">
          <p className="text-center text-sm text-muted-foreground">
            Sign in to your account to place orders, track deliveries, and earn Super Coins.
          </p>
          <Button
            className="w-full h-11 bg-[#2874F0] hover:bg-[#2874F0]/90 gap-2"
            onClick={signIn}
            disabled={isLoading}
          >
            {isLoading ? "Loading..." : "Log in"}
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </motion.div>
    </div>
  );
}
