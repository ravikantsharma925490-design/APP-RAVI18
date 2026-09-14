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
                  1. Account Registration & Google OAuth
                </h3>
                <p>
                  By signing in to LiveConnect with your Google account, you agree to these Terms of Use and Privacy Policy. Initial onboarding requires setting up your profile with a Display Name, unique @username handle, Gender, and Country selection.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-blue-500" />
                  2. Real-Time Video, Audio & Messaging Features
                </h3>
                <p>
                  LiveConnect offers 1-on-1 HD video calling, voice calling, instant messaging, media sharing, and random global user matching. You agree to use these features responsibly for lawful and respectful communication.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-500" />
                  3. Virtual Coins & Gifting System
                </h3>
                <p>
                  Virtual coins and gifts sent during calls or chats are non-refundable in-app items intended for entertainment and user appreciation. Coins hold no monetary cash value outside the LiveConnect platform.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-500" />
                  4. Community Guidelines & Safety Policy
                </h3>
                <p>
                  We maintain zero tolerance for harassment, hate speech, explicit nudity, abusive behavior, impersonation, or spam. Users violating community safety guidelines are subject to immediate blocking, report investigation, and permanent account ban.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-500" />
                  5. Account Deletion & Right to Terminate
                </h3>
                <p>
                  You retain full ownership of your account and can permanently delete your profile, chat messages, and data at any time from your settings with immediate effect.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-medium">
                🔒 <strong>Our Privacy Pledge:</strong> LiveConnect protects your personal identity. We do not sell, rent, or share your private data or communication logs with third parties.
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-emerald-500" />
                  1. Information We Collect
                </h3>
                <p>
                  We store basic profile data: Google account email, Display Name, unique @username, Avatar photo URL, Gender, Country, Bio, coin balance, and online presence status to enable app functionality.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-emerald-500" />
                  2. WebRTC Encrypted Video & Audio Calls
                </h3>
                <p>
                  Real-time audio and video streams are transmitted using WebRTC end-to-end media encryption directly between peers. We do not record or store your live video or voice calls.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  3. Messaging & Data Security
                </h3>
                <p>
                  All text messages, coin transactions, and friend connections are protected with database Row-Level Security (RLS), ensuring only authorized participants can access their private communications.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  4. Instant Data Removal & Privacy Controls
                </h3>
                <p>
                  You have complete control over your privacy settings. You can block unwanted users, turn off active status visibility, or erase your entire account history with one click.
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
