import React, { useState } from 'react';
import { X, ShieldCheck, Lock, Eye, FileText, CheckCircle2 } from 'lucide-react';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'terms' | 'privacy';
  onAgreeAndContinue?: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'terms',
  onAgreeAndContinue,
}) => {
  const [tab, setTab] = useState<'terms' | 'privacy'>(initialTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white w-full max-w-lg rounded-3xl p-6 md:p-8 shadow-2xl border border-neutral-200 dark:border-neutral-800 flex flex-col max-h-[85vh] relative animate-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-neutral-900 dark:text-white">
                LiveConnect Legal
              </h2>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                User Safety, Privacy & Terms of Service
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="grid grid-cols-2 gap-2 my-4 p-1 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-xs font-bold">
          <button
            type="button"
            onClick={() => setTab('terms')}
            className={`py-2 rounded-xl transition-all cursor-pointer ${
              tab === 'terms'
                ? 'bg-white dark:bg-neutral-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            Terms of Use
          </button>
          <button
            type="button"
            onClick={() => setTab('privacy')}
            className={`py-2 rounded-xl transition-all cursor-pointer ${
              tab === 'privacy'
                ? 'bg-white dark:bg-neutral-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            Privacy Policy
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pr-1 text-xs leading-relaxed space-y-4 text-neutral-600 dark:text-neutral-300">
          {tab === 'terms' ? (
            <>
              <div className="space-y-2">
                <h3 className="font-bold text-sm text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-blue-500" />
                  1. Acceptance of Terms & Account Registration
                </h3>
                <p>
                  By creating an account or logging in to LiveConnect, you agree to comply with and be bound by these Terms of Use and Privacy Policy. Account registration requires a valid email address, display name, unique username handle, and country selection.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-blue-500" />
                  2. User Accounts, Handles & Password Recovery
                </h3>
                <p>
                  You are responsible for maintaining the confidentiality of your login credentials and unique username handle. Password resets are handled securely via single-use Email Reset Links sent directly to your verified inbox.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-500" />
                  3. OTP Verification & 5-Minute Expiration
                </h3>
                <p>
                  Sign-up verification codes (OTPs) generated for account creation remain valid for exactly 5 minutes (300 seconds). Requesting a new code automatically generates a fresh token to protect your account.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-500" />
                  4. Community Standards & Communication Safety
                </h3>
                <p>
                  LiveConnect enforces a mutual-follow communication model. You agree not to use voice/video calls or instant messages for harassment, spam, fraudulent activities, or illegal behavior. Users violating safety guidelines are subject to immediate account restriction.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-500" />
                  5. Free &amp; Unlimited Real-Time Features
                </h3>
                <p>
                  All voice and video calling, real-time messaging, and online status features on LiveConnect are 100% free and unlimited. No paid subscriptions, hidden fees, or advertisements are required.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-medium">
                🔒 <strong>Our Strict Privacy Pledge:</strong> Your information is used exclusively for account authentication and delivering real-time communication. We never sell, lease, or share personal user data with third parties.
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-emerald-500" />
                  1. Information We Collect
                </h3>
                <p>
                  We collect essential account details: your email address, chosen display name, unique username handle (@username), avatar/profile picture, selected country, and account creation timestamp.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-emerald-500" />
                  2. Audio, Video & Message Encryption
                </h3>
                <p>
                  Voice and video calls use peer-to-peer encrypted WebRTC media connections. We do not record, store, or monitor your private voice/video conversations or direct messages.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  3. Secure Authentication & Password Recovery
                </h3>
                <p>
                  Authentication data, hashed passwords, and temporary 5-minute verification tokens are stored securely with row-level security (RLS). Password resets are authorized exclusively via direct single-use email links.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  4. Data Ownership & Instant Deletion
                </h3>
                <p>
                  You retain full control over your personal data. You may edit your profile, clear chat histories, or delete your account at any time with immediate effect across all servers.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer Action */}
        <div className="pt-4 mt-2 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-2">
          {onAgreeAndContinue ? (
            <button
              onClick={() => {
                onAgreeAndContinue();
                onClose();
              }}
              className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all active:scale-95 cursor-pointer"
            >
              Agree & Continue
            </button>
          ) : (
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-2xl bg-neutral-900 dark:bg-neutral-800 hover:bg-neutral-800 dark:hover:bg-neutral-700 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
