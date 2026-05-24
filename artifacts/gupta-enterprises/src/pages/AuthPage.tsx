import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, ArrowLeft, RotateCcw, CheckCircle2, Gift } from "lucide-react";

type Step = "phone" | "otp" | "referral";

const RESEND_TIMEOUT = 30;

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

export function AuthPage() {
  const [, navigate] = useLocation();
  const { firebaseUser, dbUser, isLoading } = useAuth();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [referralCode, setReferralCode] = useState("");
  const [confirmResult, setConfirmResult] = useState<ConfirmationResult | null>(null);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [isNewUser, setIsNewUser] = useState(false);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isLoading && firebaseUser && dbUser) navigate("/");
  }, [firebaseUser, dbUser, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = undefined;
      }
    };
  }, []);

  function startResendTimer() {
    setResendTimer(RESEND_TIMEOUT);
    timerRef.current = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  function ensureRecaptcha() {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        { size: "invisible" }
      );
    }
    return window.recaptchaVerifier;
  }

  async function handleSendOtp() {
    setError("");
    const cleaned = phone.replace(/\s/g, "");
    if (!/^\+?[1-9]\d{9,14}$/.test(cleaned)) {
      setError("Please enter a valid mobile number (10 digits).");
      return;
    }
    // Ensure +91 prefix for Indian numbers without country code
    const e164 = cleaned.startsWith("+") ? cleaned : `+91${cleaned}`;

    setSending(true);
    try {
      const verifier = ensureRecaptcha();
      const result = await signInWithPhoneNumber(auth, e164, verifier);
      setConfirmResult(result);
      setStep("otp");
      startResendTimer();
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("too-many-requests")) {
        setError("Too many attempts. Please wait a few minutes and try again.");
      } else if (msg.includes("invalid-phone-number")) {
        setError("Invalid phone number. Please include country code (e.g. +91).");
      } else {
        setError("Failed to send OTP. Please try again.");
      }
      // Reset recaptcha on error
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = undefined;
      }
    } finally {
      setSending(false);
    }
  }

  async function handleResend() {
    if (resendTimer > 0) return;
    setOtp(["", "", "", "", "", ""]);
    setError("");
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear();
      window.recaptchaVerifier = undefined;
    }
    await handleSendOtp();
  }

  async function handleVerifyOtp() {
    if (!confirmResult) return;
    const code = otp.join("");
    if (code.length !== 6) {
      setError("Please enter the complete 6-digit OTP.");
      return;
    }
    setError("");
    setVerifying(true);
    try {
      const credential = await confirmResult.confirm(code);
      // Check if this is a new user by looking at metadata
      const isNew =
        credential.user.metadata.creationTime ===
        credential.user.metadata.lastSignInTime;
      setIsNewUser(isNew);

      if (isNew) {
        setStep("referral");
      } else {
        // Existing user — backend sync happens via onAuthStateChanged in AuthContext
        navigate("/");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("invalid-verification-code")) {
        setError("Incorrect OTP. Please check and try again.");
      } else if (msg.includes("code-expired")) {
        setError("OTP has expired. Please request a new one.");
      } else {
        setError("Verification failed. Please try again.");
      }
    } finally {
      setVerifying(false);
    }
  }

  async function handleReferralSubmit(skip = false) {
    const ref = skip ? undefined : referralCode.trim() || undefined;
    // Send idToken + optional referral code to backend
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (idToken) {
        await fetch("/api/auth/firebase-callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ idToken, referralCode: ref }),
        });
      }
    } catch {
      // ignore
    }
    navigate("/");
  }

  function handleOtpChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
    if (newOtp.every((d) => d !== "") && newOtp.join("").length === 6) {
      // Auto-verify
      setTimeout(() => {
        const code = newOtp.join("");
        if (code.length === 6 && confirmResult) {
          setVerifying(true);
          confirmResult
            .confirm(code)
            .then((credential) => {
              const isNew =
                credential.user.metadata.creationTime ===
                credential.user.metadata.lastSignInTime;
              setIsNewUser(isNew);
              if (isNew) setStep("referral");
              else navigate("/");
            })
            .catch((err: unknown) => {
              const msg = err instanceof Error ? err.message : String(err);
              if (msg.includes("invalid-verification-code")) {
                setError("Incorrect OTP. Please check and try again.");
              } else {
                setError("Verification failed. Please try again.");
              }
            })
            .finally(() => setVerifying(false));
        }
      }, 50);
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!paste) return;
    const newOtp = [...otp];
    paste.split("").forEach((char, i) => { if (i < 6) newOtp[i] = char; });
    setOtp(newOtp);
    const nextEmpty = newOtp.findIndex((d) => !d);
    otpRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#2874F0]/8 via-background to-amber-50/30 px-4 py-12">
      <div id="recaptcha-container" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[#2874F0] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#2874F0]/30">
            <span className="text-2xl font-bold text-white">G</span>
          </div>
          <h1 className="text-2xl font-bold">Gupta Enterprises</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Your favourite stationery store in Kohima
          </p>
        </div>

        <div className="bg-card border rounded-2xl shadow-sm p-6">
          <AnimatePresence mode="wait">
            {/* ── STEP 1: Phone Number ─────────────────────────── */}
            {step === "phone" && (
              <motion.div
                key="phone"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col gap-4"
              >
                <div className="flex flex-col gap-1">
                  <h2 className="font-semibold text-lg">Login or Sign up</h2>
                  <p className="text-sm text-muted-foreground">
                    Enter your mobile number to receive an OTP
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="phone">Mobile Number</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      <span className="text-sm">+91</span>
                    </span>
                    <Input
                      id="phone"
                      type="tel"
                      inputMode="numeric"
                      placeholder="98765 43210"
                      className="pl-16 h-11"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value.replace(/[^\d\s+]/g, ""));
                        setError("");
                      }}
                      onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-red-500 text-center">{error}</p>
                )}

                <Button
                  className="w-full h-11 bg-[#2874F0] hover:bg-[#2874F0]/90"
                  onClick={handleSendOtp}
                  disabled={sending || !phone.trim()}
                >
                  {sending ? "Sending OTP…" : "Get OTP"}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  By continuing, you agree to our{" "}
                  <a href="/terms" className="text-[#2874F0] hover:underline">
                    Terms & Conditions
                  </a>
                </p>
              </motion.div>
            )}

            {/* ── STEP 2: OTP Verification ─────────────────────── */}
            {step === "otp" && (
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col gap-5"
              >
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setStep("phone");
                      setOtp(["", "", "", "", "", ""]);
                      setError("");
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h2 className="font-semibold text-lg">Enter OTP</h2>
                    <p className="text-sm text-muted-foreground">
                      Sent to{" "}
                      <span className="font-medium text-foreground">
                        {phone.startsWith("+") ? phone : `+91 ${phone}`}
                      </span>
                    </p>
                  </div>
                </div>

                {/* OTP input boxes */}
                <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className="w-11 h-12 text-center text-xl font-bold border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2874F0] bg-background transition-all"
                    />
                  ))}
                </div>

                {error && (
                  <p className="text-sm text-red-500 text-center">{error}</p>
                )}

                <Button
                  className="w-full h-11 bg-[#2874F0] hover:bg-[#2874F0]/90"
                  onClick={handleVerifyOtp}
                  disabled={verifying || otp.join("").length !== 6}
                >
                  {verifying ? "Verifying…" : "Verify OTP"}
                </Button>

                <div className="text-center">
                  {resendTimer > 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Resend OTP in{" "}
                      <span className="font-semibold text-[#2874F0]">
                        {resendTimer}s
                      </span>
                    </p>
                  ) : (
                    <button
                      onClick={handleResend}
                      className="text-sm text-[#2874F0] hover:underline flex items-center gap-1 mx-auto"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Resend OTP
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── STEP 3: Referral Code (New Users) ────────────── */}
            {step === "referral" && (
              <motion.div
                key="referral"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col gap-5"
              >
                <div className="text-center">
                  <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-7 h-7 text-green-600" />
                  </div>
                  <h2 className="font-semibold text-lg">Welcome to Gupta Enterprises!</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your account has been created successfully.
                  </p>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                  <Gift className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800">Have a referral code?</p>
                    <p className="text-amber-700 mt-0.5">
                      Enter it below to get <strong>50 Super Coins</strong> added to your wallet!
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="referral">Referral Code (optional)</Label>
                  <Input
                    id="referral"
                    placeholder="e.g. GUPT1234"
                    className="h-11 uppercase"
                    value={referralCode}
                    onChange={(e) =>
                      setReferralCode(e.target.value.toUpperCase())
                    }
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleReferralSubmit(false)
                    }
                  />
                </div>

                <Button
                  className="w-full h-11 bg-[#2874F0] hover:bg-[#2874F0]/90"
                  onClick={() => handleReferralSubmit(false)}
                >
                  {referralCode.trim() ? "Apply & Continue" : "Continue"}
                </Button>

                <button
                  onClick={() => handleReferralSubmit(true)}
                  className="text-sm text-muted-foreground hover:text-foreground text-center hover:underline"
                >
                  Skip for now
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
