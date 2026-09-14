import React, { useState, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { useLanguage } from '@/src/lib/LanguageContext';
import { TermsAgreementModal } from '@/src/components/legal/TermsAgreementModal';
import { LegalModal } from '@/src/components/legal/LegalModal';
import { resetRejectedOAuth, setStoredAuthIntent } from '@/src/hooks/useAuth';

interface AuthPageProps {
  onSignIn?: (email: string, pass: string) => Promise<any>;
  onSignUp?: (email: string, pass: string, name: string, username: string, country?: string) => Promise<any>;
  onSendLoginOtp?: (email: string) => Promise<any>;
  onGoogleSignIn?: () => Promise<any>;
  onResetPassword?: (email: string) => Promise<any>;
  onStartPasswordRecovery?: () => void;
  onOpenConfig?: () => void;
  authError: string | null;
  clearError: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  onGoogleSignIn,
  onOpenConfig,
  authError,
  clearError,
}) => {
  const { currentLanguage, openLanguageModal, t } = useLanguage();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

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

  useEffect(() => {
    if (authError === 'Account already exists!') {
      setMode('signup');
    } else if (authError === 'Account not found!') {
      setMode('login');
    }
  }, [authError]);

  const switchMode = (newMode: 'login' | 'signup') => {
    resetRejectedOAuth();
    setStoredAuthIntent(newMode);
    setMode(newMode);
    clearError();
    setGoogleError(null);
  };

  const handleGoogleAuth = async () => {
    resetRejectedOAuth();
    setStoredAuthIntent(mode);
    clearError();
    setGoogleError(null);

    if (!agreedTerms) {
      setGoogleError('Please agree to the Terms of Use and Privacy Policy to continue.');
      return;
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_intent_mode', mode);
      sessionStorage.setItem('auth_intent_mode', mode);
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('auth_intent', mode);
        window.history.replaceState({}, '', url.toString());
      } catch {}
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

        const redirectUrl = `${origin}?auth_intent=${mode}`;

        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
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
        setGoogleError('Google Sign-In is not enabled in Supabase. Please enable Google provider in your Supabase Dashboard.');
      } else {
        setGoogleError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const activeError = googleError || authError;

  return (
    <div className="min-h-screen-safe w-full flex items-center justify-center p-4 bg-neutral-950 text-white relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Language Switcher */}
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

      {/* Main Card */}
      <div className="w-full max-w-md p-8 md:p-10 rounded-3xl bg-neutral-900/90 border border-neutral-800 shadow-2xl backdrop-blur-xl relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25 mx-auto">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">
            LiveConnect
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            {mode === 'login' ? 'Login' : 'Sign Up'}
          </h1>
          <p className="text-xs text-neutral-400 font-medium">
            {mode === 'login'
              ? 'Sign in to your LiveConnect account with Google'
              : 'Create a new LiveConnect account with Google'}
          </p>
        </div>

        {/* Error Messages Banner */}
        {activeError && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs leading-relaxed animate-in fade-in space-y-2">
            <div className="font-semibold text-sm">{activeError}</div>
            {onOpenConfig && (activeError.toLowerCase().includes('relation') ||
              activeError.toLowerCase().includes('function') ||
              activeError.toLowerCase().includes('trigger') ||
              activeError.toLowerCase().includes('column')) && (
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

        {/* Content Box */}
        <div className="space-y-4">
          {/* Terms Checkbox */}
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

          {/* Google Sign-In / Sign-Up Button */}
          <button
            type="button"
            onClick={handleGoogleAuth}
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

          {/* Switch Mode Footer Link */}
          <div className="pt-3 text-center">
            {mode === 'login' ? (
              <p className="text-xs text-neutral-400 font-medium">
                You don’t have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className="text-blue-400 hover:text-blue-300 font-bold hover:underline cursor-pointer ml-1 transition-colors"
                >
                  Sign Up
                </button>
              </p>
            ) : (
              <p className="text-xs text-neutral-400 font-medium">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-blue-400 hover:text-blue-300 font-bold hover:underline cursor-pointer ml-1 transition-colors"
                >
                  Login
                </button>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Pop-up Agreement Modal */}
      <TermsAgreementModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onAgree={() => {
          setAgreedTerms(true);
          setShowTermsModal(false);
        }}
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
        }}
      />
    </div>
  );
};
