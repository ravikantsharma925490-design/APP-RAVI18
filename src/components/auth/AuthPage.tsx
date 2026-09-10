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
  onResetPassword: (email: string) => Promise<any>;
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
  onResetPassword,
  onOpenConfig,
  authError,
  clearError,
}) => {
  const { currentLanguage, openLanguageModal, t } = useLanguage();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
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
  const [resetSent, setResetSent] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
        const res = await onSignUp(email, password, displayName, clean, country);
        if (res?.session) {
          setSuccessMessage('Account created! Logging you in...');
        } else {
          setSuccessMessage(
            'Account created successfully! If email confirmation is enabled in your Supabase project, please verify your email inbox before signing in.'
          );
        }
      } else if (mode === 'forgot') {
        await onResetPassword(email);
        setResetSent(true);
        setSuccessMessage('Password reset instructions sent to your email.');
      }
    } catch (err: any) {
      // Error handled in parent hook
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
          </p>
        </div>

        {/* Tab Switcher */}
        {mode !== 'forgot' && (
          <div className="grid grid-cols-2 p-1 rounded-xl bg-neutral-800/80 border border-neutral-700/60 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                clearError();
              }}
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
              onClick={() => {
                setMode('signup');
                clearError();
              }}
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
        {authError && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs leading-relaxed animate-in fade-in space-y-2">
            <div>{authError}</div>
            {(authError.toLowerCase().includes('trigger') ||
              authError.toLowerCase().includes('database') ||
              authError.toLowerCase().includes('settings') ||
              authError.toLowerCase().includes('supabase')) && (
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <>
              {/* Full Display Name */}
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Display Name / Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="Enter your full name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-neutral-800/80 border border-neutral-700 text-white placeholder-neutral-500 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Custom Unique Username */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-neutral-300">
                    Unique Username
                  </label>
                  <span className="text-[10px] text-neutral-400 font-mono">
                    letters, numbers, _
                  </span>
                </div>
                <div className="relative">
                  <AtSign className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    pattern="^[a-zA-Z0-9_]{3,}$"
                    title="At least 3 characters. Only letters, numbers, and underscores."
                    placeholder="Enter unique username (min 3 chars)"
                    value={username}
                    onChange={(e) =>
                      setUsername(
                        e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                      )
                    }
                    className={`w-full pl-10 pr-10 py-2.5 rounded-xl bg-neutral-800/80 border text-white placeholder-neutral-500 text-base focus:outline-none focus:ring-2 font-mono transition-all ${
                      usernameStatus === 'available'
                        ? 'border-emerald-500/60 focus:ring-emerald-500'
                        : usernameStatus === 'taken'
                        ? 'border-red-500/60 focus:ring-red-500'
                        : 'border-neutral-700 focus:ring-blue-500'
                    }`}
                  />
                  {/* Status icon inside input */}
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    {usernameStatus === 'checking' && (
                      <Loader2 className="w-4 h-4 text-neutral-400 animate-spin" />
                    )}
                    {usernameStatus === 'available' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                    {usernameStatus === 'taken' && (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                </div>

                {/* Real-time username feedback text */}
                {usernameFeedback && (
                  <p
                    className={`text-[11px] mt-1 pl-1 font-medium transition-all ${
                      usernameStatus === 'available'
                        ? 'text-emerald-400'
                        : usernameStatus === 'taken'
                        ? 'text-red-400'
                        : usernameStatus === 'invalid'
                        ? 'text-amber-400'
                        : 'text-neutral-400'
                    }`}
                  >
                    {usernameFeedback}
                  </p>
                )}
              </div>

              {/* Country Selection Dropdown */}
              <div className="relative" ref={countryDropdownRef}>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5 flex items-center justify-between">
                  <span>Country / Region</span>
                  <span className="text-[10px] text-neutral-400">
                    {selectedCountryObj.dialCode}
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsCountryOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-neutral-800/80 border border-neutral-700 hover:border-neutral-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-lg leading-none shrink-0">
                      {selectedCountryObj.flag}
                    </span>
                    <span className="truncate text-neutral-100 font-medium text-xs md:text-sm">
                      {selectedCountryObj.name}
                    </span>
                    <span className="text-[11px] text-neutral-400 font-mono shrink-0">
                      ({selectedCountryObj.code})
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-neutral-400 transition-transform shrink-0 ml-2 ${
                      isCountryOpen ? 'rotate-180 text-blue-400' : ''
                    }`}
                  />
                </button>

                {/* Country Picker Flyout */}
                {isCountryOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 max-h-64 bg-neutral-900 border border-neutral-700/80 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col backdrop-blur-xl animate-in fade-in zoom-in-95">
                    {/* Search bar inside country dropdown */}
                    <div className="p-2 border-b border-neutral-800 bg-neutral-950/60 sticky top-0 z-10">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          autoFocus
                          placeholder="Search country or dial code..."
                          value={countrySearch}
                          onChange={(e) => setCountrySearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-neutral-800 border border-neutral-700 text-base text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* Scrollable list of 195+ countries */}
                    <div className="overflow-y-auto max-h-48 divide-y divide-neutral-800/40 overscroll-contain">
                      {filteredCountries.length === 0 ? (
                        <div className="p-4 text-center text-xs text-neutral-500">
                          No country matched "{countrySearch}"
                        </div>
                      ) : (
                        filteredCountries.map((c) => {
                          const isSelected =
                            c.name.toLowerCase() === country.toLowerCase() ||
                            c.code.toLowerCase() === country.toLowerCase();
                          return (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => {
                                setCountry(c.name);
                                setIsCountryOpen(false);
                                setCountrySearch('');
                              }}
                              className={`w-full flex items-center justify-between px-3.5 py-2 text-xs text-left hover:bg-neutral-800/80 transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-blue-600/15 text-blue-300 font-semibold'
                                  : 'text-neutral-300'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 truncate">
                                <span className="text-base leading-none">
                                  {c.flag}
                                </span>
                                <span className="truncate">{c.name}</span>
                                <span className="text-[10px] text-neutral-500 font-mono">
                                  {c.dialCode}
                                </span>
                              </div>
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-blue-400 shrink-0 ml-2" />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

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
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-neutral-800/80 border border-neutral-700 text-white placeholder-neutral-500 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-neutral-300">
                  Password
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      clearError();
                    }}
                    className="text-xs text-blue-400 hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-neutral-800/80 border border-neutral-700 text-white placeholder-neutral-500 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>
          )}

          {/* Terms & Privacy Policy Checkbox (Required for Login and Signup) */}
          {mode !== 'forgot' && (
            <div className="pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer group select-none">
                <input
                  type="checkbox"
                  checked={agreedTerms}
                  onChange={(e) => setAgreedTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded-md border-neutral-700 bg-neutral-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-neutral-900 cursor-pointer transition-all"
                />
                <span className="text-xs text-neutral-400 group-hover:text-neutral-300 leading-relaxed">
                  I agree to the{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLegalDocModal({ isOpen: true, tab: 'terms' });
                    }}
                    className="text-neutral-200 underline font-semibold hover:text-blue-400 cursor-pointer"
                  >
                    Terms of use
                  </button>{' '}
                  and{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLegalDocModal({ isOpen: true, tab: 'privacy' });
                    }}
                    className="text-neutral-200 underline font-semibold hover:text-blue-400 cursor-pointer"
                  >
                    Privacy policy
                  </button>
                </span>
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={
              loading ||
              (mode === 'signup' && (usernameStatus === 'taken' || usernameStatus === 'checking'))
            }
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 mt-2 cursor-pointer"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>
                  {mode === 'login' && 'Sign In'}
                  {mode === 'signup' && 'Create Account'}
                  {mode === 'forgot' && 'Send Reset Link'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Forgot Password back link */}
        {mode === 'forgot' && (
          <div className="text-center text-xs text-neutral-400 pt-2">
            <button
              onClick={() => {
                setMode('login');
                clearError();
              }}
              className="font-semibold text-blue-400 hover:underline cursor-pointer"
            >
              Back to sign in
            </button>
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
