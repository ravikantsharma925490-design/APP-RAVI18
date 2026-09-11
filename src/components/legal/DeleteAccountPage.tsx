import React from 'react';
import { Trash2, ArrowLeft, ShieldAlert, Mail, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';

interface DeleteAccountPageProps {
  onBack?: () => void;
}

export const DeleteAccountPage: React.FC<DeleteAccountPageProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100 flex flex-col font-sans overflow-y-auto">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-neutral-900/90 backdrop-blur-md border-b border-neutral-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-white">Delete Account</h1>
              <p className="text-xs text-neutral-400">LiveConnect Account & Data Deletion Policy</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 space-y-8">
        {/* Banner Alert */}
        <div className="p-4 rounded-2xl bg-red-950/40 border border-red-800/60 flex items-start gap-3.5">
          <ShieldAlert className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-red-200">Permanent Account & Data Erasure</h2>
            <p className="text-xs text-red-300/80 leading-relaxed">
              In accordance with Google Play and Apple App Store User Data Policies, LiveConnect provides full self-service in-app account deletion as well as web-based deletion requests. Deleting your account is permanent and cannot be reversed.
            </p>
          </div>
        </div>

        {/* Option 1: In-App Deletion */}
        <section className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xs">
              1
            </span>
            <h3 className="text-base font-bold text-white">How to Delete Your Account In-App</h3>
          </div>

          <p className="text-xs text-neutral-400 leading-relaxed">
            If you have the LiveConnect application installed on your device, you can delete your account instantly:
          </p>

          <ol className="space-y-3 text-xs text-neutral-300">
            <li className="flex items-start gap-2.5 p-3 rounded-xl bg-neutral-800/50 border border-neutral-700/50">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong>Step 1:</strong> Open <strong>LiveConnect</strong> and navigate to your <strong>Profile</strong> tab or tap the <strong>Settings (Shield)</strong> icon.
              </div>
            </li>
            <li className="flex items-start gap-2.5 p-3 rounded-xl bg-neutral-800/50 border border-neutral-700/50">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong>Step 2:</strong> Scroll down to the <strong>Account & Danger Zone</strong> section.
              </div>
            </li>
            <li className="flex items-start gap-2.5 p-3 rounded-xl bg-neutral-800/50 border border-neutral-700/50">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong>Step 3:</strong> Click the red <strong>"Delete Account"</strong> button.
              </div>
            </li>
            <li className="flex items-start gap-2.5 p-3 rounded-xl bg-neutral-800/50 border border-neutral-700/50">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong>Step 4:</strong> Read the confirmation prompt, type <code className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-red-400 font-mono text-[11px]">DELETE</code> in the input field, and confirm.
              </div>
            </li>
          </ol>
        </section>

        {/* Option 2: Fallback Web Deletion Request */}
        <section className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-xs">
              2
            </span>
            <h3 className="text-base font-bold text-white">Manual Deletion Request (Without App)</h3>
          </div>

          <p className="text-xs text-neutral-400 leading-relaxed">
            If you no longer have the app installed or cannot log in, you may submit a manual account deletion request. Our privacy team will process your request within 24 to 48 hours.
          </p>

          <div className="p-4 rounded-2xl bg-neutral-800/60 border border-neutral-700 space-y-3 text-xs">
            <div className="flex items-center gap-2 font-bold text-neutral-200">
              <Mail className="w-4 h-4 text-amber-400" />
              <span>Email Account Deletion Request</span>
            </div>
            <p className="text-neutral-400">
              Send an email to our official privacy support address:
            </p>
            <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 font-mono text-xs text-amber-300 flex items-center justify-between">
              <span>ravikantsharma925490@gmail.com</span>
              <a
                href="mailto:ravikantsharma925490@gmail.com?subject=LiveConnect%20Account%20Deletion%20Request"
                className="px-3 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors flex items-center gap-1 text-[11px] font-sans font-bold"
              >
                Send Email <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="text-[11px] text-neutral-400 space-y-1">
              <p><strong>Subject line:</strong> LiveConnect Account Deletion Request</p>
              <p><strong>Information required:</strong> Your registered email address and username.</p>
            </div>
          </div>
        </section>

        {/* Data Deleted vs Retained */}
        <section className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            What Data is Deleted?
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-neutral-800/40 border border-neutral-700/60 space-y-2">
              <h4 className="font-bold text-red-400 uppercase text-[10px] tracking-wider">Permanently Deleted Immediately</h4>
              <ul className="space-y-1.5 text-neutral-300 list-disc list-inside">
                <li>User profile details (Display Name, Username, Bio, Avatar)</li>
                <li>All chat messages & media attachments</li>
                <li>Call logs & audio/video room history</li>
                <li>Followers and following relationships</li>
                <li>Blocked users list & in-app notifications</li>
                <li>Authentication credentials and account token</li>
              </ul>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-800/40 border border-neutral-700/60 space-y-2">
              <h4 className="font-bold text-amber-400 uppercase text-[10px] tracking-wider">Data Retention Policy</h4>
              <p className="text-neutral-300 leading-relaxed">
                No personal user data is retained after deletion. Once the deletion process completes, your user identifier is purged completely from our Supabase database and authentication server.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-800 py-6 text-center text-xs text-neutral-500">
        LiveConnect Security & Privacy Team • All Rights Reserved
      </footer>
    </div>
  );
};
