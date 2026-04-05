import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Mail, Lock, User, Phone, Eye, EyeOff, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/FirebaseContext";
import { toast } from "sonner";

export function AuthPage() {
  const [, navigate] = useLocation();
  const { currentUser, signInWithGoogle, signInWithEmailPassword, signUpWithEmail, setupRecaptcha, sendPhoneOTP } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmResult, setConfirmResult] = useState<import("firebase/auth").ConfirmationResult | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const recaptchaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentUser) navigate("/");
  }, [currentUser]);

  useEffect(() => {
    if (recaptchaRef.current) {
      setupRecaptcha("recaptcha-container");
    }
  }, []);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError("");
    try {
      await signInWithGoogle();
      navigate("/");
    } catch (e: unknown) {
      setError("Google sign-in failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      await signInWithEmailPassword(email, password);
      navigate("/");
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === "auth/invalid-credential") setError("Invalid email or password");
      else if (err.code === "auth/user-not-found") setError("No account found with this email");
      else setError("Sign-in failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setIsLoading(true);
    setError("");
    try {
      await signUpWithEmail(email, password, name);
      navigate("/");
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === "auth/email-already-in-use") setError("An account with this email already exists");
      else if (err.code === "auth/weak-password") setError("Password is too weak");
      else setError("Sign-up failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.startsWith("+")) { setError("Phone must include country code (e.g. +91 98765 43210)"); return; }
    setIsLoading(true);
    setError("");
    try {
      const result = await sendPhoneOTP(phone);
      setConfirmResult(result);
      toast.success("OTP sent to your phone!");
    } catch (e: unknown) {
      setError("Failed to send OTP. Check the phone number and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmResult) return;
    setIsLoading(true);
    setError("");
    try {
      await confirmResult.confirm(otp);
      navigate("/");
    } catch (e: unknown) {
      setError("Invalid OTP. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 px-4 py-12">
      <div id="recaptcha-container" ref={recaptchaRef} />

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-2xl font-bold text-white">G</span>
          </div>
          <h1 className="text-2xl font-bold">Gupta Enterprises</h1>
          <p className="text-muted-foreground mt-1">Your favourite stationery store</p>
        </div>

        <div className="bg-card border rounded-2xl shadow-sm p-6">
          {error && (
            <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg px-3 py-2 mb-4 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Google Sign In */}
          <Button variant="outline" className="w-full gap-2 mb-4" onClick={handleGoogleSignIn} disabled={isLoading}>
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </Button>

          <div className="relative mb-4">
            <Separator />
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
              or continue with
            </span>
          </div>

          <Tabs defaultValue="login">
            <TabsList className="w-full mb-4">
              <TabsTrigger value="login" className="flex-1">Sign In</TabsTrigger>
              <TabsTrigger value="signup" className="flex-1">Sign Up</TabsTrigger>
              <TabsTrigger value="phone" className="flex-1">Phone</TabsTrigger>
            </TabsList>

            {/* Email Login */}
            <TabsContent value="login">
              <form onSubmit={handleEmailSignIn} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="email" required placeholder="Email address"
                    className="w-full pl-9 pr-4 py-2.5 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type={showPassword ? "text" : "password"} required placeholder="Password"
                    className="w-full pl-9 pr-10 py-2.5 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={password} onChange={e => setPassword(e.target.value)} />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(p => !p)}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Button type="submit" className="w-full gap-2" disabled={isLoading}>
                  {isLoading ? "Signing in..." : <>Sign In <ArrowRight className="w-4 h-4" /></>}
                </Button>
              </form>
            </TabsContent>

            {/* Email Signup */}
            <TabsContent value="signup">
              <form onSubmit={handleEmailSignUp} className="space-y-3">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="text" placeholder="Full name (optional)"
                    className="w-full pl-9 pr-4 py-2.5 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="email" required placeholder="Email address"
                    className="w-full pl-9 pr-4 py-2.5 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type={showPassword ? "text" : "password"} required placeholder="Password (min 6 chars)"
                    className="w-full pl-9 pr-10 py-2.5 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={password} onChange={e => setPassword(e.target.value)} />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowPassword(p => !p)}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Button type="submit" className="w-full gap-2" disabled={isLoading}>
                  {isLoading ? "Creating account..." : <>Create Account <ArrowRight className="w-4 h-4" /></>}
                </Button>
              </form>
            </TabsContent>

            {/* Phone OTP */}
            <TabsContent value="phone">
              {!confirmResult ? (
                <form onSubmit={handleSendOTP} className="space-y-3">
                  <p className="text-xs text-muted-foreground">Enter your phone number with country code</p>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input type="tel" required placeholder="+91 98765 43210"
                      className="w-full pl-9 pr-4 py-2.5 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      value={phone} onChange={e => setPhone(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full gap-2" disabled={isLoading}>
                    {isLoading ? "Sending OTP..." : "Send OTP"}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOTP} className="space-y-3">
                  <p className="text-sm text-muted-foreground">Enter the 6-digit OTP sent to {phone}</p>
                  <input type="text" required placeholder="Enter OTP" maxLength={6}
                    className="w-full px-4 py-2.5 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50 text-center tracking-widest text-lg"
                    value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ""))} />
                  <Button type="submit" className="w-full" disabled={isLoading || otp.length < 6}>
                    {isLoading ? "Verifying..." : "Verify OTP"}
                  </Button>
                  <button type="button" className="w-full text-sm text-muted-foreground hover:text-foreground"
                    onClick={() => setConfirmResult(null)}>
                    Change phone number
                  </button>
                </form>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}

function Separator() {
  return <div className="border-t" />;
}
