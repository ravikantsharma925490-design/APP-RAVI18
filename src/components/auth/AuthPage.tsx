import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Mail,
  Lock,
  User,
  AtSign,
  ArrowRight,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Loader2,
  Globe,
  ChevronDown,
  Search,
  Check,
} from 'lucide-react';
import { checkUsernameAvailability } from '@/src/hooks/useAuth';
import { useLanguage } from '@/src/lib/LanguageContext';
import { WORLD_COUNTRIES, WorldCountry } from '@/src/lib/worldData';
import { TermsAgreementModal } from '@/src/components/legal/TermsAgreementModal';
import { LegalModal } from '@/src/components/legal/LegalModal';

interface AuthPageProps {
  onSignIn: (email: string, pass: string) => Promise<any>;
  onSignUp: (email: string, pass: string, name: string, username: string, country?: string) => Promise<any>;
  onSendLoginOtp?: (email: string) => Promise<any>;
  onGoogleSignIn?: () => Promise<any>;
  onResetPassword: (email: string) => Promise<any>;
  onStartPasswordRecovery?: () => void;
  onOpenConfig: () => void;
  authError: string | null;
  clearError: () => void;
}

function detectDefaultCountry(): string {
  try {
    if (typeof Intl !== 'undefined') {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      if (tz.includes('Calcutta') || tz.includes('Kolkata') || tz.includes('India')) return 'India';
      if (tz.includes('New_York') || tz.includes('Los_Angeles') || tz.includes('Chicago') || tz.includes('Denver')) return 'United States';
      if (tz.includes('London')) return 'United Kingdom';
      if (tz.includes('Dubai')) return 'United Arab Emirates';
      if (tz.includes('Riyadh')) return 'Saudi Arabia';
      if (tz.includes('Berlin') || tz.includes('Frankfurt')) return 'Germany';
      if (tz.includes('Paris')) return 'France';
      if (tz.includes('Toronto') || tz.includes('Vancouver')) return 'Canada';
      if (tz.includes('Sydney') || tz.includes('Melbourne')) return 'Australia';
      if (tz.includes('Karachi')) return 'Pakistan';
      if (tz.includes('Dhaka')) return 'Bangladesh';
      if (tz.includes('Kathmandu')) return 'Nepal';
      if (tz.includes('Singapore')) return 'Singapore';
      if (tz.includes('Tokyo')) return 'Japan';
    }
    if (typeof navigator !== 'undefined' && navigator.language) {
      const lang = navigator.language.toLowerCase();
      if (lang.includes('in') || lang.includes('hi')) return 'India';
      if (lang.includes('us')) return 'United States';
      if (lang.includes('gb') || lang.includes('uk')) return 'United Kingdom';
    }
  } catch (e) {}
  return 'India';
}

export const AuthPage: React.FC<AuthPageProps> = ({
  onSignIn,
  onSignUp,
  onSendLoginOtp,
  onGoogleSignIn,
  onResetPassword,
  onStartPasswordRecovery,
  onOpenConfig,
  authError,
  clearError,
}) => {
  const { currentLanguage, openLanguageModal, t } = useLanguage();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'verify-otp'>('login');

  const switchMode = (newMode: 'login' | 'signup' | 'forgot' | 'verify-otp') => {
    setMode(newMode);
    clearError();
    if (typeof window !== 'undefined' && (newMode === 'login' || newMode === 'signup')) {
      localStorage.setItem('auth_intent_mode', newMode);
    }
  };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [country, setCountry] = useState<string>(detectDefaultCountry);
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  >('idle');
  const [usernameFeedback, setUsernameFeedback] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [googleError, setGoogleError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    clearError();
    setGoogleError(null);

    if (!agreedTerms) {
      setGoogleError('Please agree to the Terms of Use and Privacy Policy to continue.');
      return;
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_intent_mode', mode);
    }

    setLoading(true);
    try {
      if (onGoogleSignIn) {
        await onGoogleSignIn();
      } else {
        const supabase = (await import('@/src/lib/supabase/client')).getSupabase();
        if (!supabase) throw new Error('Database client unavailable');
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: origin,
            skipBrowserRedirect: isInIframe,
            queryParams: {
              access_type: 'offline',
              prompt: 'consent',
            },
          },
        });
        if (error) throw error;

        if (isInIframe && data?.url) {
          const popup = window.open(data.url, '_blank', 'width=500,height=600');
          if (!popup || popup.closed || typeof popup.closed === 'undefined') {
            try {
              window.top!.location.href = data.url;
            } catch (e) {
              window.location.href = data.url;
            }
          }
        }
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.error('Google Sign In Error:', err);
      if (
        msg.toLowerCase().includes('provider is not enabled') ||
        msg.toLowerCase().includes('unsupported provider') ||
        msg.toLowerCase().includes('provider is disabled')
      ) {
        setGoogleError('Google Sign-In Supabase mein enabled nahi hai. Supabase Dashboard (Authentication -> Providers -> Google) mein Client ID & Secret enable karein.');
      } else {
        setGoogleError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    await handleGoogleSignIn();
  };
  const [resetSent, setResetSent] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // OTP Verification States
  const [otpCode, setOtpCode] = useState('');
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState('');
  const [pendingSignupPassword, setPendingSignupPassword] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);

  // Terms & Privacy Agreement State
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [legalDocModal, setLegalDocModal] = useState<{
    isOpen: boolean;
    tab: 'terms' | 'privacy';
  }>({
    isOpen: false,
    tab: 'terms',
  });

  const checkTimerRef = useRef<any>(null);
  const countryDropdownRef = useRef<HTMLDivElement>(null);

  // Close country dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        countryDropdownRef.current &&
        !countryDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCountryOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return WORLD_COUNTRIES;
    const q = countrySearch.toLowerCase().trim();
    return WORLD_COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        (c.dialCode && c.dialCode.toLowerCase().includes(q)) ||
        (c.nativeName && c.nativeName.toLowerCase().includes(q))
    );
  }, [countrySearch]);

  const selectedCountryObj = useMemo(() => {
    return (
      WORLD_COUNTRIES.find(
        (c) =>
          c.name.toLowerCase() === country.toLowerCase() ||
          c.code.toLowerCase() === country.toLowerCase()
      ) || WORLD_COUNTRIES[0]
    );
  }, [country]);

  // Live real-time username availability checker
  useEffect(() => {
    if (mode !== 'signup') {
      setUsernameStatus('idle');
      setUsernameFeedback('');
      return;
    }

    const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!clean) {
      setUsernameStatus('idle');
      setUsernameFeedback('');
      return;
    }

    if (clean.length < 3) {
      setUsernameStatus('invalid');
      setUsernameFeedback('Username must be at least 3 characters (letters, numbers, _ only).');
      return;
    }

    setUsernameStatus('checking');
    setUsernameFeedback('Checking username availability...');

    if (checkTimerRef.current) {
      clearTimeout(checkTimerRef.current);
    }

    checkTimerRef.current = setTimeout(async () => {
      try {
        const result = await checkUsernameAvailability(clean);
        if (result.available) {
          setUsernameStatus('available');
          setUsernameFeedback(`✓ @${clean} is available!`);
        } else {
          setUsernameStatus('taken');
          setUsernameFeedback(result.message || `✕ @${clean} is already taken.`);
        }
      } catch (err) {
        setUsernameStatus('available');
        setUsernameFeedback('');
      }
    }, 350);

    return () => {
      if (checkTimerRef.current) {
        clearTimeout(checkTimerRef.current);
      }
    };
  }, [username, mode]);

  const executeAuthAction = async () => {
    clearError();
    setSuccessMessage(null);

    if (typeof window !== 'undefined' && (mode === 'login' || mode === 'signup')) {
      localStorage.setItem('auth_intent_mode', mode);
    }

    if (mode === 'signup') {
      const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (clean.length < 3) {
        setUsernameStatus('invalid');
        setUsernameFeedback('Username must be at least 3 characters.');
        return;
      }

      if (usernameStatus === 'taken') {
        setUsernameFeedback(`✕ @${clean} is already taken. Please choose another username.`);
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        await onSignIn(email, password);
      } else if (mode === 'signup') {
        const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
        const result = await onSignUp(email, password, displayName, clean, country);
        if (result?.needsOtp) {
          setPendingVerifyEmail(email.trim());
          setPendingSignupPassword(password);
          setMode('verify-otp');
          setSuccessMessage('A 6-digit verification code was sent to your email!');
        } else {
          clearError();
          setSuccessMessage('🎉 Account created successfully! Logging you in...');
          try {
            const supabase = (await import('@/src/lib/supabase/client')).getSupabase();
            const currentSess = supabase ? await supabase.auth.getSession() : null;
            if (!currentSess?.data?.session?.user) {
              await onSignIn(email, password);
            }
          } catch (ign) {
            // Handled by auto-confirm fallback
          }
        }
      } else if (mode === 'forgot') {
        await onResetPassword(email);
        setResetSent(true);
        setSuccessMessage('✨ Password reset link sent to your email! Open your Gmail inbox and click the reset link to create a new password.');
      }
    } catch (err: any) {
      // Error handled in parent hook
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyRecoveryOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);
    setLoading(true);
    try {
      const supabase = (await import('@/src/lib/supabase/client')).getSupabase();
      if (!supabase) throw new Error('Database client unavailable');
      const targetEmail = pendingVerifyEmail || email;
      const { error } = await supabase.auth.verifyOtp({
        email: targetEmail.trim(),
        token: otpCode.trim(),
        type: 'recovery',
      });
      if (error) throw error;
      setSuccessMessage('Recovery code verified! Set your new password.');
      if (onStartPasswordRecovery) {
        onStartPasswordRecovery();
      } else {
        window.location.reload();
      }
    } catch (err: any) {
      setOtpError(err.message || 'Invalid or expired recovery code.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Enforce Terms & Conditions and Privacy Policy agreement before proceeding
    if (mode === 'login' || mode === 'signup') {
      if (!agreedTerms) {
        setShowTermsModal(true);
        return;
      }
    }

    await executeAuthAction();
  };

  const handleAgreeAndContinue = async () => {
    setAgreedTerms(true);
    setShowTermsModal(false);
    await executeAuthAction();
  };

  const handleSendLoginOtp = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      clearError();
      setSuccessMessage('Please enter a valid email address first.');
      return;
    }
    setLoading(true);
    try {
      if (onSendLoginOtp) {
        await onSendLoginOtp(email);
      } else {
        const res = await fetch('/api/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim().toLowerCase(), type: 'login' }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to send OTP code');
      }
      setPendingVerifyEmail(email.trim());
      setMode('verify-otp');
      setSuccessMessage('An OTP verification code was sent to your email!');
    } catch (err: any) {
      // Error is handled in parent hook
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);
    setLoading(true);
    try {
      const supabase = (await import('@/src/lib/supabase/client')).getSupabase();
      if (!supabase) throw new Error('Database client unavailable');

      let verifiedSession: any = null;
      let lastError: any = null;

      const cleanEmail = pendingVerifyEmail.toLowerCase().trim();
      const cleanCode = otpCode.trim();
      const nowIso = new Date().toISOString();

      // 1. First check server API & user_otps database table for ANY valid unexpired code
      try {
        const apiRes = await fetch('/api/auth/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, otpCode: cleanCode }),
        });
        if (apiRes.ok) {
          const apiJson = await apiRes.json();
          if (apiJson.verified) {
            verifiedSession = { user: { email: cleanEmail } };
          }
        }
      } catch (apiErr) { /* ignore */ }

      if (!verifiedSession) {
        try {
          const { data: rows } = await supabase
            .from('user_otps')
            .select('*')
            .ilike('email', cleanEmail)
            .gt('expires_at', nowIso);

          if (rows && rows.length > 0) {
            const match = rows.find((r: any) => r.otp_code === cleanCode && r.verified !== true);
            if (match) {
              verifiedSession = { user: { email: cleanEmail } };
              try {
                await supabase.from('user_otps').update({ verified: true }).eq('id', match.id);
              } catch (uErr) { /* ignore */ }
            }
          }
        } catch (dbErr) { /* ignore */ }
      }

      // 2. If not verified via user_otps table, check native Supabase verifyOtp
      if (!verifiedSession) {
        const typesToTry: ('email' | 'signup' | 'magiclink' | 'recovery')[] = ['email', 'signup', 'magiclink', 'recovery'];
        for (const otpType of typesToTry) {
          try {
            const res = await supabase.auth.verifyOtp({
              email: cleanEmail,
              token: cleanCode,
              type: otpType,
            });
            if (!res.error && (res.data?.session || res.data?.user)) {
              verifiedSession = res.data;
              try {
                await supabase.from('user_otps').upsert([
                  {
                    email: cleanEmail,
                    otp_code: cleanCode,
                    type: otpType,
                    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
                    verified: true
                  }
                ]);
              } catch (e) { /* ignore */ }
              break;
            } else {
              lastError = res.error;
            }
          } catch (e) {
            lastError = e;
          }
        }
      }

      if (!verifiedSession) {
        throw lastError || new Error('Invalid or expired OTP code. Please request a new OTP.');
      }

      if (pendingSignupPassword) {
        let loggedIn = false;
        try {
          const confirmRes = await fetch('/api/auth/confirm-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: pendingVerifyEmail.trim(), password: pendingSignupPassword }),
          });
          const confirmData = await confirmRes.json();
          if (confirmData?.session) {
            const { data: sData } = await supabase.auth.setSession(confirmData.session);
            if (sData?.user) {
              loggedIn = true;
            }
          }
        } catch (cErr) {
          console.warn('[handleVerifyOtp] confirm-user notice:', cErr);
        }

        if (!loggedIn) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: pendingVerifyEmail,
            password: pendingSignupPassword,
          });
          if (signInError) throw signInError;
        }
      }

      setSuccessMessage('OTP code verified! Logging you in...');
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err: any) {
      setOtpError(err.message || 'Invalid or expired code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setOtpError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingVerifyEmail, type: 'signup' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not resend code.');
      if (data.otpCode) {
        setSuccessMessage('Fresh 6-digit verification code sent to your Gmail inbox!');
      } else {
        setSuccessMessage('A fresh 6-digit verification code has been sent to your email!');
      }
    } catch (err: any) {
      setOtpError(err.message || 'Could not resend code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen-safe w-full flex items-center justify-center p-4 bg-neutral-950 text-white relative overflow-hidden">
      {/* Subtle Background Glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top Floating Language Switcher */}
      <div className="absolute top-4 right-4 md:top-6 md:right-6 z-20">
        <button
          type="button"
          onClick={openLanguageModal}
          className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 text-xs font-semibold text-neutral-300 hover:text-white transition-all shadow-lg backdrop-blur-md cursor-pointer hover:scale-105 active:scale-95"
        >
          <span className="text-base">{currentLanguage.flag}</span>
          <span>{currentLanguage.nativeName}</span>
          <span className="text-[10px] text-neutral-500 font-mono">({currentLanguage.code.toUpperCase()})</span>
        </button>
      </div>

      {/* Main Clean Card */}
      <div className="w-full max-w-md p-8 md:p-10 rounded-3xl bg-neutral-900/90 border border-neutral-800 shadow-2xl backdrop-blur-xl relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25 mx-auto">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            LiveConnect
          </h1>
          <p className="text-xs text-neutral-400 font-medium">
            {mode === 'login' && t('auth.welcomeBack', 'Welcome back to LiveConnect')}
            {mode === 'signup' && t('auth.createAccount', 'Create your LiveConnect account')}
            {mode === 'forgot' && t('auth.forgotPassword', 'Reset your account password')}
            {mode === 'verify-otp' && 'Verify your email'}
          </p>
        </div>

        {/* Tab Switcher (Sign In vs Sign Up) */}
        {mode !== 'forgot' && mode !== 'verify-otp' && (
          <div className="grid grid-cols-2 p-1 rounded-xl bg-neutral-800/80 border border-neutral-700/60 text-xs font-semibold">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`py-2 rounded-lg transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-blue-600 text-white shadow-sm font-bold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {t('auth.signIn', 'Sign In')}
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`py-2 rounded-lg transition-all cursor-pointer ${
                mode === 'signup'
                  ? 'bg-blue-600 text-white shadow-sm font-bold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {t('auth.signUp', 'Create Account')}
            </button>
          </div>
        )}

        {/* Error & Success Messages */}
        {(authError || googleError) && mode !== 'verify-otp' && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs leading-relaxed animate-in fade-in space-y-2">
            <div>{googleError || authError}</div>
            {authError && (authError.toLowerCase().includes('relation') ||
              authError.toLowerCase().includes('function') ||
              authError.toLowerCase().includes('trigger') ||
              authError.toLowerCase().includes('column')) && (
              <button
                type="button"
                onClick={onOpenConfig}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-200 text-xs font-semibold transition-all cursor-pointer"
              >
                ⚙️ Open SQL Schema & Fix Guide
              </button>
            )}
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs leading-relaxed animate-in fade-in">
            {successMessage}
          </div>
        )}

        {/* Main Clean Card Container */}
        {mode !== 'verify-otp' && (
          <div className="space-y-4">
            {/* Terms & Privacy Agreement Checkbox */}
            <div className="p-3 rounded-2xl bg-neutral-800/50 border border-neutral-700/80 hover:border-neutral-600 transition-all">
              <label className="flex items-start gap-2.5 cursor-pointer group select-none">
                <input
                  type="checkbox"
                  checked={agreedTerms}
                  onChange={(e) => setAgreedTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-neutral-600 bg-neutral-900 text-blue-500 focus:ring-blue-500 focus:ring-offset-neutral-900 cursor-pointer transition-all"
                />
                <span className="text-xs text-neutral-300 group-hover:text-white leading-relaxed">
                  I agree to the{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLegalDocModal({ isOpen: true, tab: 'terms' });
                    }}
                    className="text-blue-400 font-semibold underline hover:text-blue-300 cursor-pointer"
                  >
                    Terms of Use
                  </button>{' '}
                  and{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLegalDocModal({ isOpen: true, tab: 'privacy' });
                    }}
                    className="text-blue-400 font-semibold underline hover:text-blue-300 cursor-pointer"
                  >
                    Privacy Policy
                  </button>
                </span>
              </label>
            </div>

            {/* Google Sign-In Primary Action */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-neutral-100 text-neutral-900 font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-white/10 disabled:opacity-50 transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99] mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-neutral-800/30 border-t-neutral-800 rounded-full animate-spin" />
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 48 48" className="shrink-0">
                    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
                  </svg>
                  <span className="text-sm font-bold">
                    {mode === 'login' ? 'Continue with Google' : 'Sign Up with Google'}
                  </span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Verify OTP Mode */}
        {mode === 'verify-otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto text-lg font-bold">
                ✉️
              </div>
              <h3 className="text-sm font-semibold text-white">Check Your Email Inbox</h3>
              <p className="text-xs text-neutral-300 leading-relaxed">
                A verification code was sent to <span className="text-white font-medium">{pendingVerifyEmail}</span>.
              </p>
            </div>

            <div className="pt-1">
              <p className="text-xs text-neutral-400 text-center mb-2">
                Enter 6-digit verification code:
              </p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="000000"
                className="w-full text-center text-2xl tracking-[0.5em] py-3 rounded-xl bg-neutral-800/80 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            {otpError && (
              <p className="text-xs text-red-400 text-center font-medium">{otpError}</p>
            )}

            <button
              type="submit"
              disabled={loading || otpCode.length !== 6}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Verify Code & Continue'
              )}
            </button>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={handleResendOtp}
                className="text-blue-400 hover:underline font-semibold cursor-pointer"
              >
                Resend Code
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  clearError();
                  setOtpError(null);
                }}
                className="text-neutral-400 hover:text-neutral-200 cursor-pointer"
              >
                Back to signup
              </button>
            </div>
          </form>
        )}

        {/* Forgot Password Mode */}
        {mode === 'forgot' && (
          <div className="space-y-4 pt-1">
            {resetSent ? (
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto text-lg font-bold">
                    🔑
                  </div>
                  <h3 className="text-sm font-semibold text-white">Reset Link Sent</h3>
                  <p className="text-xs text-neutral-300 leading-relaxed">
                    Password reset link sent to <span className="text-white font-medium">{pendingVerifyEmail || email}</span>.
                  </p>
                </div>

                <form onSubmit={handleVerifyRecoveryOtp} className="space-y-3 p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 shadow-inner">
                  <p className="text-xs text-neutral-400 text-center">
                    Or enter your 6-digit recovery code below:
                  </p>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="000000"
                    className="w-full text-center text-2xl tracking-[0.5em] py-2.5 rounded-xl bg-neutral-800 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  {otpError && (
                    <p className="text-xs text-red-400 text-center font-medium">{otpError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={loading || otpCode.length !== 6}
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      'Verify Code & Set Password'
                    )}
                  </button>
                </form>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      placeholder="you@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-neutral-800/80 border border-neutral-700 text-white placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
              </form>
            )}

            <div className="text-center text-xs text-neutral-400">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  clearError();
                  setResetSent(false);
                  setOtpCode('');
                }}
                className="font-semibold text-blue-400 hover:underline cursor-pointer"
              >
                Back to sign in
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pop-up Agreement Modal (Matches User Reference Image) */}
      <TermsAgreementModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onAgree={handleAgreeAndContinue}
        onOpenLegalDoc={(tab) => setLegalDocModal({ isOpen: true, tab })}
      />

      {/* Detailed Legal Documents Viewer Modal */}
      <LegalModal
        isOpen={legalDocModal.isOpen}
        onClose={() => setLegalDocModal({ isOpen: false, tab: 'terms' })}
        initialTab={legalDocModal.tab}
        onAgreeAndContinue={() => {
          setAgreedTerms(true);
          setLegalDocModal({ isOpen: false, tab: 'terms' });
          if (showTermsModal) {
            handleAgreeAndContinue();
          }
        }}
      />
    </div>
  );
};
