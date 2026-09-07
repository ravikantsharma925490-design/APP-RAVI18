import React, { useState } from 'react';
import {
  Shield,
  ArrowLeft,
  Calendar,
  Lock,
  Eye,
  Database,
  Video,
  Mic,
  Server,
  Share2,
  Trash2,
  UserCheck,
  AlertTriangle,
  FileText,
  Mail,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface PrivacyPolicyProps {
  onBack: () => void;
  onOpenContactSupport?: () => void;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({
  onBack,
  onOpenContactSupport,
}) => {
  const [activeSectionId, setActiveSectionId] = useState<string>('intro');
  const lastUpdatedDate = 'August 17, 2026';

  const tableOfContents = [
    { id: 'introduction', label: '1. Introduction', icon: FileText },
    { id: 'information-collected', label: '2. Information We Collect', icon: Eye },
    { id: 'how-we-use', label: '3. How We Use Information', icon: Sparkles },
    { id: 'messages-calls', label: '4. Messages & Calls', icon: Video },
    { id: 'camera-mic', label: '5. Camera & Microphone Permissions', icon: Mic },
    { id: 'data-storage', label: '6. Data Storage', icon: Database },
    { id: 'data-sharing', label: '7. Data Sharing', icon: Share2 },
    { id: 'data-security', label: '8. Data Security', icon: Lock },
    { id: 'data-retention', label: '9. Data Retention', icon: Calendar },
    { id: 'account-deletion', label: '10. Account & Data Deletion', icon: Trash2 },
    { id: 'user-rights', label: '11. User Rights', icon: UserCheck },
    { id: 'children-privacy', label: '12. Children’s Privacy', icon: AlertTriangle },
    { id: 'cookies-analytics', label: '13. Cookies & Local Storage', icon: Server },
    { id: 'third-party', label: '14. Third-Party Services', icon: ExternalLink },
    { id: 'changes-policy', label: '15. Changes to Privacy Policy', icon: FileText },
    { id: 'contact-us', label: '16. Contact Us', icon: Mail },
  ];

  const scrollToSection = (id: string) => {
    setActiveSectionId(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 overflow-hidden font-sans">
      {/* Top Header */}
      <header className="p-4 md:p-6 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shadow-xs sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-all active:scale-95 flex items-center gap-1.5 text-xs font-bold cursor-pointer"
            title="Back to Help Center"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Help Center</span>
          </button>
          <div>
            <h1 className="text-lg md:text-xl font-extrabold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span>Privacy Policy</span>
            </h1>
            <p className="text-xs text-neutral-500 font-medium hidden sm:block">
              Route: /app/help/privacy • Real-time communication data practices
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-semibold flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-blue-500" />
            <span>Updated: {lastUpdatedDate}</span>
          </div>
        </div>
      </header>

      {/* Main Layout Container */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        {/* Desktop Quick Table of Contents Sidebar */}
        <aside className="hidden lg:block w-72 border-r border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/40 backdrop-blur-md overflow-y-auto p-4 space-y-1 shrink-0">
          <div className="px-3 py-2 text-xs font-bold text-neutral-400 uppercase tracking-wider">
            Policy Sections
          </div>
          {tableOfContents.map((item) => {
            const Icon = item.icon;
            const isActive = activeSectionId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all text-left group cursor-pointer',
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800/60 hover:text-neutral-900 dark:hover:text-neutral-200'
                )}
              >
                <Icon className={cn('w-3.5 h-3.5 shrink-0', isActive ? 'text-white' : 'text-neutral-400 group-hover:text-blue-500')} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Scrollable Document Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-28 md:pb-12 scroll-smooth">
          <div className="max-w-3xl mx-auto space-y-8">
            {/* Header Document Banner */}
            <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-br from-blue-600/10 via-indigo-600/5 to-purple-600/10 dark:from-blue-950/40 dark:via-indigo-950/20 dark:to-purple-950/30 border border-blue-200/60 dark:border-blue-900/50 shadow-xs relative overflow-hidden">
              <div className="flex items-start gap-4">
                <div className="p-3.5 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                  <Shield className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight">
                    Privacy Policy
                  </h2>
                  <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                    This Privacy Policy explains how information is collected, processed, stored, and protected when you use this real-time communication application, including text messaging, one-to-one audio calling, and one-to-one video calling features.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-semibold text-neutral-500">
                    <span>Effective Date: {lastUpdatedDate}</span>
                    <span>•</span>
                    <span>Status: Active & Enforced</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 1: Introduction */}
            <section id="introduction" className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
                <FileText className="w-5 h-5" />
                <h3 className="text-base md:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  1. Introduction
                </h3>
              </div>
              <div className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-2.5">
                <p>
                  Welcome to LiveConnect (&quot;the Application&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). We respect your privacy and are committed to protecting the information you share with us through our real-time messaging, audio calling, and video calling web application.
                </p>
                <p>
                  This Privacy Policy applies to all registered users and visitors accessing our services through web browsers and connected devices. By creating an account or using the Application, you acknowledge and understand the collection and use of information in accordance with this policy.
                </p>
              </div>
            </section>

            {/* Section 2: Information We Collect */}
            <section id="information-collected" className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
                <Eye className="w-5 h-5" />
                <h3 className="text-base md:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  2. Information We Collect
                </h3>
              </div>
              <p className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                To provide core messaging, real-time presence, and audio/video calling capabilities, the Application collects and processes the following categories of information:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/60 space-y-1">
                  <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">👤 Account & Profile Information</h4>
                  <ul className="text-xs text-neutral-600 dark:text-neutral-400 space-y-1 list-disc list-inside">
                    <li>Username and handle (@username)</li>
                    <li>Display name (user-chosen title)</li>
                    <li>Profile picture URL / Avatar image</li>
                    <li>Custom biography / Status message</li>
                    <li>Account creation timestamp</li>
                  </ul>
                </div>

                <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/60 space-y-1">
                  <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">🟢 Presence & Activity State</h4>
                  <ul className="text-xs text-neutral-600 dark:text-neutral-400 space-y-1 list-disc list-inside">
                    <li>Real-time online / offline status indicator</li>
                    <li>Last seen timestamp for active sessions</li>
                    <li>Heartbeat signals to maintain presence state</li>
                  </ul>
                </div>

                <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/60 space-y-1">
                  <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">💬 Messages & Communications</h4>
                  <ul className="text-xs text-neutral-600 dark:text-neutral-400 space-y-1 list-disc list-inside">
                    <li>One-to-one text message content</li>
                    <li>Message timestamps (sent at / read at)</li>
                    <li>Conversation participant membership IDs</li>
                    <li>Read receipts and delivery states</li>
                  </ul>
                </div>

                <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/60 space-y-1">
                  <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">📞 Call Records & Diagnostics</h4>
                  <ul className="text-xs text-neutral-600 dark:text-neutral-400 space-y-1 list-disc list-inside">
                    <li>Call type (One-to-one Audio or Video)</li>
                    <li>Caller & Recipient participant identifiers</li>
                    <li>Call status (completed, missed, declined, cancelled)</li>
                    <li>Call duration in seconds & timestamps</li>
                    <li>Device / browser technical metadata when required</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 3: How We Use Information */}
            <section id="how-we-use" className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
                <Sparkles className="w-5 h-5" />
                <h3 className="text-base md:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  3. How We Use Information
                </h3>
              </div>
              <p className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                We use the collected information strictly for operational, functional, and security purposes, including:
              </p>
              <ul className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 space-y-2 list-disc list-inside pl-1">
                <li><strong>Providing Text Messaging:</strong> Transmitting, displaying, and synchronizing messages in real time between conversation participants.</li>
                <li><strong>Providing Audio & Video Calling:</strong> Establishing WebRTC peer sessions, routing signaling data, and managing active room connections.</li>
                <li><strong>Maintaining User Accounts:</strong> Authenticating logins, managing profile identities, and securing session tokens.</li>
                <li><strong>Displaying Presence Status:</strong> Showing accurate online status and last seen timestamps to your contacts.</li>
                <li><strong>Maintaining Call History:</strong> Logging incoming, outgoing, and missed call logs for personal review.</li>
                <li><strong>Security & Reliability:</strong> Diagnosing connection failures, preventing abuse or unauthorized access, and improving server stability.</li>
              </ul>
            </section>

            {/* Section 4: Messages & Calls */}
            <section id="messages-calls" className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
                <Video className="w-5 h-5" />
                <h3 className="text-base md:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  4. Messages & Calls
                </h3>
              </div>
              <div className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-2.5">
                <p>
                  <strong>Text Messaging:</strong> Messages are delivered over encrypted HTTPS/WSS transport connections and stored in our managed PostgreSQL database (Supabase) protected by database-level Row-Level Security (RLS) policies. Messages are queryable only by the authenticated participants of each conversation.
                </p>
                <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-200">
                  <p className="font-semibold mb-1">Notice Regarding Encryption:</p>
                  <p>
                    Audio and video streams are transmitted using standard peer-to-peer WebRTC SRTP/DTLS transport encryption directly between call participants. However, this application does <strong>not</strong> implement independent client-side end-to-end encryption (E2EE) key exchange for stored text messages. Stored message data is safeguarded by strict database authentication, access controls, and TLS transport security.
                  </p>
                </div>
                <p>
                  <strong>Audio and Video Calling:</strong> Live media (voice and camera streams) flows directly between call participants using peer-to-peer WebRTC connections. Active audio/video streams are processed in real time and are <strong>not recorded or stored</strong> on our application servers.
                </p>
              </div>
            </section>

            {/* Section 5: Camera & Microphone Permissions */}
            <section id="camera-mic" className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
                <Mic className="w-5 h-5" />
                <h3 className="text-base md:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  5. Camera & Microphone Permissions
                </h3>
              </div>
              <div className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-2.5">
                <p>
                  To enable real-time voice and video conversations, the Application requests hardware permissions via standard browser APIs (<code>navigator.mediaDevices.getUserMedia</code>).
                </p>
                <ul className="space-y-1.5 list-disc list-inside pl-1 text-xs">
                  <li><strong>Microphone Permission:</strong> Required during audio and video calls to capture your voice stream. You can mute or unmute your microphone at any time using the on-screen toggle.</li>
                  <li><strong>Camera Permission:</strong> Required during video calls to capture your video stream. You can enable/disable video or switch camera orientations (front/rear) at any time.</li>
                </ul>
                <p>
                  <strong>User Control:</strong> Permission prompts are governed exclusively by your device operating system and web browser. You can modify, grant, or revoke microphone and camera permissions at any time through your browser settings or device security preferences. Media hardware is accessed <em>only</em> while you are actively connected to a call or running the hardware diagnostic test.
                </p>
              </div>
            </section>

            {/* Section 6: Data Storage */}
            <section id="data-storage" className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
                <Database className="w-5 h-5" />
                <h3 className="text-base md:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  6. Data Storage
                </h3>
              </div>
              <div className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-2.5">
                <p>
                  Account credentials, user profiles, conversation memberships, message logs, call history records, and support inquiries are stored in secure cloud backend databases (Supabase PostgreSQL).
                </p>
                <p>
                  We do not expose database connection secrets, service role keys, or internal infrastructure tokens to client browsers. All public communication relies on authenticated JWT tokens and scoped user privileges.
                </p>
              </div>
            </section>

            {/* Section 7: Data Sharing */}
            <section id="data-sharing" className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
                <Share2 className="w-5 h-5" />
                <h3 className="text-base md:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  7. Data Sharing
                </h3>
              </div>
              <div className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-2.5">
                <p>
                  <strong>We do not sell, rent, or trade your personal information</strong> to data brokers, advertisers, or third-party marketing entities.
                </p>
                <p>
                  Information is shared only in the following limited circumstances:
                </p>
                <ul className="space-y-1.5 list-disc list-inside pl-1 text-xs">
                  <li><strong>With Other Users:</strong> Your display name, username, avatar, bio, online presence status, and messages are visible to other users with whom you interact.</li>
                  <li><strong>Essential Service Providers:</strong> With third-party infrastructure providers necessary to operate the application (such as cloud hosting, database hosting, and WebRTC streaming infrastructure).</li>
                  <li><strong>Legal Compliance:</strong> If required to do so by applicable laws, regulations, subpoena, or lawful governmental requests, or to protect the vital safety, integrity, and security of our users and services.</li>
                </ul>
              </div>
            </section>

            {/* Section 8: Data Security */}
            <section id="data-security" className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
                <Lock className="w-5 h-5" />
                <h3 className="text-base md:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  8. Data Security
                </h3>
              </div>
              <div className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-2.5">
                <p>
                  We implement reasonable and standard technical, administrative, and organizational measures to safeguard your information against unauthorized access, loss, misuse, or alteration:
                </p>
                <ul className="space-y-1.5 list-disc list-inside pl-1 text-xs">
                  <li>Encrypted HTTPS and TLS data transmission in transit.</li>
                  <li>Database Row-Level Security (RLS) enforcing strict authorization checks.</li>
                  <li>JWT (JSON Web Token) session authentication.</li>
                  <li>Secure password hashing for user accounts.</li>
                </ul>
                <p className="text-xs text-neutral-500">
                  While we work diligently to protect your information, no method of transmission over the Internet or electronic storage is 100% infallible; therefore, we cannot guarantee absolute security.
                </p>
              </div>
            </section>

            {/* Section 9: Data Retention */}
            <section id="data-retention" className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
                <Calendar className="w-5 h-5" />
                <h3 className="text-base md:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  9. Data Retention
                </h3>
              </div>
              <div className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-2.5">
                <p>
                  We retain user information only for as long as reasonably necessary to fulfill the operational purposes outlined in this Privacy Policy, provide ongoing messaging and calling services, resolve disputes, enforce agreements, and satisfy legitimate security or legal compliance requirements.
                </p>
                <p>
                  When an account is deleted or data is purged upon request, corresponding personal information and records are removed or anonymized from active production databases in accordance with our standard deletion workflows.
                </p>
              </div>
            </section>

            {/* Section 10: Account & Data Deletion */}
            <section id="account-deletion" className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
                <Trash2 className="w-5 h-5" />
                <h3 className="text-base md:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  10. Account & Data Deletion
                </h3>
              </div>
              <div className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-2.5">
                <p>
                  Users have the right to request the permanent deletion of their account, profile data, and associated records.
                </p>
                <div className="p-4 rounded-2xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-900/50 space-y-2 text-xs">
                  <h4 className="font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                    <span>How to Request Account Deletion:</span>
                  </h4>
                  <p className="text-neutral-700 dark:text-neutral-300">
                    To request complete account or conversation history deletion, you can:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-neutral-700 dark:text-neutral-300">
                    <li>Submit an account deletion inquiry via <strong>Help Center &rarr; 7. Contact Support</strong>.</li>
                    <li>Email the support team directly at <a href="mailto:ravikantsharma925490@gmail.com" className="font-mono text-blue-600 dark:text-blue-400 underline font-semibold">ravikantsharma925490@gmail.com</a> with the subject line <em>&quot;Account Deletion Request&quot;</em>.</li>
                  </ol>
                  <p className="text-neutral-500 pt-1 text-[11px]">
                    Requests will be verified against the registered account email before deletion is executed.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 11: User Rights */}
            <section id="user-rights" className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
                <UserCheck className="w-5 h-5" />
                <h3 className="text-base md:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  11. User Rights
                </h3>
              </div>
              <div className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-2">
                <p>Subject to applicable regional privacy regulations, you possess the following rights regarding your personal information:</p>
                <ul className="space-y-1.5 list-disc list-inside pl-1 text-xs">
                  <li><strong>Right to Access:</strong> You can view your profile data, chat conversations, and call logs directly in the Application.</li>
                  <li><strong>Right to Rectification:</strong> You can edit and update your display name, avatar, and bio at any time from the Profile tab.</li>
                  <li><strong>Right to Erasure:</strong> You can request deletion of your account and personal records.</li>
                  <li><strong>Right to Inquire:</strong> You can contact our technical support at any time regarding privacy practices or data processing.</li>
                </ul>
              </div>
            </section>

            {/* Section 12: Children's Privacy */}
            <section id="children-privacy" className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-base md:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  12. Children’s Privacy
                </h3>
              </div>
              <div className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-2">
                <p>
                  This Application is intended for general audiences and is not directed to children under the age of 13 (or the minimum legal age required in your applicable country/jurisdiction).
                </p>
                <p>
                  We do not knowingly collect personal identifiable information from children under the applicable legal age. If we become aware that a child under the minimum age has created an account without verifiable parental consent, we will take immediate steps to remove the information and deactivate the account.
                </p>
              </div>
            </section>

            {/* Section 13: Cookies & Local Storage */}
            <section id="cookies-analytics" className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
                <Server className="w-5 h-5" />
                <h3 className="text-base md:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  13. Cookies & Local Storage
                </h3>
              </div>
              <div className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-2">
                <p>
                  The Application utilizes essential browser <code>localStorage</code> and session tokens exclusively for core functional requirements:
                </p>
                <ul className="space-y-1.5 list-disc list-inside pl-1 text-xs">
                  <li><strong>Authentication Session:</strong> Storing authenticated session tokens to keep you logged in between page visits.</li>
                  <li><strong>Theme Preferences:</strong> Saving your selected theme appearance (Dark Mode / Light Mode).</li>
                  <li><strong>Service Configuration:</strong> Storing user-provided API credentials (when custom configured).</li>
                </ul>
                <p className="text-xs text-neutral-500">
                  We do not use invasive third-party cross-site advertising trackers or behavioral profiling cookies.
                </p>
              </div>
            </section>

            {/* Section 14: Third-Party Services */}
            <section id="third-party" className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
                <ExternalLink className="w-5 h-5" />
                <h3 className="text-base md:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  14. Third-Party Services
                </h3>
              </div>
              <div className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-3">
                <p>
                  The Application integrates with the following trusted third-party technology providers to deliver its real-time messaging and calling capabilities:
                </p>
                <div className="space-y-2.5">
                  <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/60 flex items-start gap-3">
                    <Database className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">Supabase (PostgreSQL & Realtime)</h4>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
                        Provides user authentication, database persistence for chats and call history, and WebSockets for real-time message sync.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/60 flex items-start gap-3">
                    <Video className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">WebRTC P2P Direct Streaming</h4>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
                        Powers low-latency, 1-to-1 audio and video calling directly between peer browsers with STUN/TURN connection traversal.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 15: Changes to Privacy Policy */}
            <section id="changes-policy" className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
                <FileText className="w-5 h-5" />
                <h3 className="text-base md:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  15. Changes to this Privacy Policy
                </h3>
              </div>
              <div className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-2">
                <p>
                  We may periodically revise or update this Privacy Policy to reflect technical improvements, new feature releases, or changes in legal regulations.
                </p>
                <p>
                  When changes are made, the <em>&quot;Last Updated&quot;</em> date at the top of this document will be updated accordingly. Continued use of the Application after revisions constitutes acceptance of the updated policy terms.
                </p>
              </div>
            </section>

            {/* Section 16: Contact Us */}
            <section id="contact-us" className="p-6 md:p-8 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
                <Mail className="w-5 h-5" />
                <h3 className="text-base md:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  16. Contact Us & Support
                </h3>
              </div>
              <div className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-3">
                <p>
                  If you have questions, inquiries, feedback, or requests regarding this Privacy Policy or how your data is handled, please contact our support team:
                </p>

                <div className="p-4 rounded-2xl bg-cyan-50/70 dark:bg-cyan-950/40 border border-cyan-200/80 dark:border-cyan-900/60 space-y-3">
                  <div className="space-y-1">
                    <p className="font-bold text-neutral-900 dark:text-neutral-100">Support Contact Email</p>
                    <a
                      href="mailto:ravikantsharma925490@gmail.com"
                      className="inline-flex items-center gap-1.5 font-mono text-sm text-blue-600 dark:text-blue-400 font-bold hover:underline"
                    >
                      <span>ravikantsharma925490@gmail.com</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <a
                      href="https://mail.google.com/mail/?view=cm&fs=1&to=ravikantsharma925490@gmail.com&su=Privacy%20Policy%20Inquiry%20-%20LiveConnect"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Open in Gmail</span>
                    </a>

                    {onOpenContactSupport && (
                      <button
                        onClick={onOpenContactSupport}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                      >
                        <span>In-App Contact Support</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Bottom Navigation Back Action */}
            <div className="pt-4 flex items-center justify-between">
              <button
                onClick={onBack}
                className="px-5 py-2.5 rounded-2xl bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold text-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Help Center</span>
              </button>

              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
              >
                Back to Top ↑
              </button>
            </div>

            {/* Copyright Footer */}
            <div className="pt-6 pb-2 text-center border-t border-neutral-200/60 dark:border-neutral-800/60">
              <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium tracking-wide">
                © 2026 LiveConnect
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
