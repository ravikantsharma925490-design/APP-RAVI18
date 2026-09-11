import React, { useState } from 'react';
import {
  FileCheck2,
  ArrowLeft,
  Calendar,
  ShieldAlert,
  UserCheck,
  PhoneCall,
  Video,
  MessageSquare,
  Ban,
  Scale,
  Server,
  AlertTriangle,
  Mail,
  ExternalLink,
  ChevronRight,
  Shield,
  Trash2,
  FileText,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface TermsConditionsProps {
  onBack: () => void;
  onOpenContactSupport?: () => void;
}

export const TermsConditions: React.FC<TermsConditionsProps> = ({
  onBack,
  onOpenContactSupport,
}) => {
  const [activeSectionId, setActiveSectionId] = useState<string>('introduction');
  const lastUpdatedDate = 'September 11, 2026';

  const tableOfContents = [
    { id: 'introduction', label: '1. Introduction', icon: FileText },
    { id: 'eligibility', label: '2. Eligibility', icon: UserCheck },
    { id: 'account-registration', label: '3. Account Registration', icon: Shield },
    { id: 'user-responsibilities', label: '4. User Responsibilities', icon: UserCheck },
    { id: 'acceptable-use', label: '5. Acceptable Use', icon: FileCheck2 },
    { id: 'messaging-rules', label: '6. Messaging Rules', icon: MessageSquare },
    { id: 'audio-calling-rules', label: '7. Audio Calling Rules', icon: PhoneCall },
    { id: 'video-calling-rules', label: '8. Video Calling Rules', icon: Video },
    { id: 'prohibited-behavior', label: '9. Prohibited Content & Behavior', icon: Ban },
    { id: 'user-content', label: '10. User Content', icon: FileText },
    { id: 'suspension-termination', label: '11. Account Suspension & Termination', icon: ShieldAlert },
    { id: 'intellectual-property', label: '12. Intellectual Property', icon: Scale },
    { id: 'third-party-services', label: '13. Third-Party Services', icon: ExternalLink },
    { id: 'service-availability', label: '14. Service Availability', icon: Server },
    { id: 'disclaimer', label: '15. Disclaimer', icon: AlertTriangle },
    { id: 'limitation-liability', label: '16. Limitation of Liability', icon: Scale },
    { id: 'account-deletion', label: '17. Account Deletion', icon: Trash2 },
    { id: 'changes-terms', label: '18. Changes to Terms', icon: FileText },
    { id: 'contact-us', label: '19. Contact Us', icon: Mail },
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
              <FileCheck2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>Terms of Use</span>
            </h1>
            <p className="text-xs text-neutral-500 font-medium hidden sm:block">
              Route: /app/help/terms • Rules &amp; User Agreement
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-500" />
            <span>Last Updated: {lastUpdatedDate}</span>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        {/* Desktop Quick Table of Contents Sidebar */}
        <aside className="hidden lg:block w-72 border-r border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/40 backdrop-blur-md overflow-y-auto p-4 space-y-1 shrink-0">
          <div className="px-3 py-2 text-xs font-bold text-neutral-400 uppercase tracking-wider">
            Terms Sections
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
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800/60 hover:text-neutral-900 dark:hover:text-neutral-200'
                )}
              >
                <Icon className={cn('w-3.5 h-3.5 shrink-0', isActive ? 'text-white' : 'text-neutral-400 group-hover:text-indigo-500')} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Scrollable Document Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-28 md:pb-12 scroll-smooth">
          <div className="max-w-3xl mx-auto space-y-8">
            {/* Header Document Banner */}
            <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-br from-indigo-600/10 via-blue-600/5 to-purple-600/10 dark:from-indigo-950/40 dark:via-blue-950/20 dark:to-purple-950/30 border border-indigo-200/60 dark:border-indigo-900/50 shadow-xs relative overflow-hidden">
              <div className="flex items-start gap-4">
                <div className="p-3.5 rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
                  <FileCheck2 className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight">
                    Terms of Use
                  </h2>
                  <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                    Please read these Terms of Use carefully before using LiveConnect (&quot;the Application&quot;). These terms govern your access to and use of our real-time messaging, one-to-one audio calling, one-to-one video calling, user profile, and call history features.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-semibold text-neutral-500">
                    <span>Effective: {lastUpdatedDate}</span>
                    <span>•</span>
                    <span>Applies to All Registered Users</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 1: Introduction */}
            <section id="introduction" className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5 text-indigo-600 dark:text-indigo-400">
                <FileText className="w-5 h-5" />
                <h3 className="text-base md:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  1. Introduction
                </h3>
              </div>
              <div className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-2.5">
                <p>
                  These Terms of Use constitute a legally binding agreement between you (&quot;User&quot;, &quot;you&quot;) and the operators of LiveConnect (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). By creating an account, logging in, or using any part of the service, you agree to be bound by these terms. If you do not agree to these terms, you must not use or access the Application.
                </p>
              </div>
            </section>

            {/* Section 2: Eligibility */}
            <section id="eligibility" className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5 text-indigo-600 dark:text-indigo-400">
                <UserCheck className="w-5 h-5" />
                <h3 className="text-base md:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  2. Eligibility
                </h3>
              </div>
              <div className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-2">
                <p>
                  To use this Application, you must meet the minimum legal age required to form a binding contract in your jurisdiction (at least 13 years of age, or higher if required by applicable local law). If you are under the age of majority in your jurisdiction, you may only use the Application with the consent and supervision of a parent or legal guardian who agrees to these Terms.
                </p>
              </div>
            </section>

            {/* Section 3: Account Registration */}
            <section id="account-registration" className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5 text-indigo-600 dark:text-indigo-400">
                <Shield className="w-5 h-5" />
                <h3 className="text-base md:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  3. Account Registration &amp; Security
                </h3>
              </div>
              <div className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-2.5">
                <p>
                  When registering an account, you must provide accurate, current, and complete information, including a valid email address and unique username.
                </p>
                <ul className="space-y-1.5 list-disc list-inside pl-1 text-xs">
                  <li>You are solely responsible for maintaining the confidentiality of your account credentials and password.</li>
                  <li>You agree to notify us immediately of any unauthorized access or breach of your account.</li>
                  <li>You may not create multiple fake accounts or register on behalf of someone else without explicit authorization.</li>
                </ul>
              </div>
            </section>

            {/* Section 4: User Responsibilities */}
            <section id="user-responsibilities" className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5 text-indigo-600 dark:text-indigo-400">
                <UserCheck className="w-5 h-5" />
                <h3 className="text-base md:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  4. User Responsibilities
                </h3>
              </div>
              <div className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-2">
                <p>You agree that you will:</p>
                <ul className="space-y-1.5 list-disc list-inside pl-1 text-xs">
                  <li>Comply with all applicable local, national, and international laws and regulations.</li>
                  <li>Maintain respectful and lawful communication with all other users of the service.</li>
                  <li>Ensure your hardware, browser, and internet connection satisfy technical requirements for real-time audio and video streaming.</li>
                </ul>
              </div>
            </section>

            {/* Section 5: Acceptable Use */}
            <section id="acceptable-use" className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5 text-indigo-600 dark:text-indigo-400">
                <FileCheck2 className="w-5 h-5" />
                <h3 className="text-base md:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  5. Acceptable Use
                </h3>
              </div>
              <div className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-2">
                <p>
                  The Application is designed exclusively for direct interpersonal real-time communication, messaging, and audio/video calls. You may not use the Application to distribute unsolicited bulk advertisements, conduct automated scraping, disrupt servers, reverse-engineer proprietary protocols, or engage in malicious activity.
                </p>
              </div>
            </section>

            {/* Section 6: Messaging Rules */}
            <section id="messaging-rules" className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5 text-indigo-600 dark:text-indigo-400">
                <MessageSquare className="w-5 h-5" />
                <h3 className="text-base md:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  6. Messaging Rules
                </h3>
              </div>
              <div className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-2">
                <p>When using the text messaging features of the Application, you agree not to:</p>
                <ul className="space-y-1.5 list-disc list-inside pl-1 text-xs">
                  <li>Send unsolicited spam, promotional blasts, phishing links, malware, or fraudulent schemes.</li>
                  <li>Harass, threaten, bully, stalk, or intimidate other users through messages.</li>
                  <li>Transmit hateful, discriminatory, defamatory, or sexually explicit textual material.</li>
                </ul>
              </div>
            </section>

            {/* Section 7: Audio Calling Rules */}
            <section id="audio-calling-rules" className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5 text-indigo-600 dark:text-indigo-400">
                <PhoneCall className="w-5 h-5" />
                <h3 className="text-base md:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  7. Audio Calling Rules
                </h3>
              </div>
              <div className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-2">
                <p>When participating in one-to-one audio voice calls, you agree to the following rules:</p>
                <ul className="space-y-1.5 list-disc list-inside pl-1 text-xs">
                  <li><strong>Consent:</strong> Do not record, rebroadcast, or distribute audio streams of other users without their express knowledge and legal consent.</li>
                  <li><strong>No Call Bombing / Flooding:</strong> Do not repeatedly call or ring users who have declined or requested to cease communication.</li>
                  <li><strong>Respectful Voice Conduct:</strong> Do not broadcast excessive acoustic disruptions, screams, hate speech, or threatening audio over microphone streams.</li>
                </ul>
              </div>
            </section>

            {/* Section 8: Video Calling Rules */}
            <section id="video-calling-rules" className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5 text-indigo-600 dark:text-indigo-400">
                <Video className="w-5 h-5" />
                <h3 className="text-base md:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  8. Video Calling Rules
                </h3>
              </div>
              <div className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-2">
                <p>When participating in one-to-one video calls, strict visual standards apply:</p>
                <ul className="space-y-1.5 list-disc list-inside pl-1 text-xs">
                  <li><strong>Zero Nudity / Explicit Visuals:</strong> Broadcasting nudity, sexual acts, obscene visual gestures, or non-consensual visual displays is strictly prohibited and results in immediate permanent termination.</li>
                  <li><strong>No Violent Imagery:</strong> Do not display graphic violence, self-harm, weapons, or illegal substances on live camera feeds.</li>
                  <li><strong>Recording Prohibition:</strong> Do not screen-capture, record, or publish live video feeds of call participants without explicit permission.</li>
                </ul>
              </div>
            </section>

            {/* Section 9: Prohibited Content & Behavior */}
            <section id="prohibited-behavior" className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
                <Ban className="w-5 h-5" />
                <h3 className="text-base md:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  9. Prohibited Content &amp; Behavior
                </h3>
              </div>
              <p className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                The following actions are strictly forbidden across all features of the Application:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3.5 rounded-2xl bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 space-y-1">
                  <h4 className="text-xs font-bold text-rose-800 dark:text-rose-300">🚫 Harassment &amp; Abuse</h4>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400">
                    Stalking, bullying, intimidating, hateful slurs, or targeted harassment of any person.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 space-y-1">
                  <h4 className="text-xs font-bold text-rose-800 dark:text-rose-300">🎭 Impersonation &amp; Deception</h4>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400">
                    Pretending to be another person, celebrity, organization, or admin to mislead users.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 space-y-1">
                  <h4 className="text-xs font-bold text-rose-800 dark:text-rose-300">💸 Scams &amp; Fraud</h4>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400">
                    Attempting to defraud users, solicit financial details, conduct phishing, or promote pyramid schemes.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 space-y-1">
                  <h4 className="text-xs font-bold text-rose-800 dark:text-rose-300">⚡ System Interference</h4>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400">
                    Attempting unauthorized database queries, sniffing media servers, or flooding APIs.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 10: User Content */}
            <section id="user-content" className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5 text-indigo-600 dark:text-indigo-400">
                <FileText className="w-5 h-5" />
                <h3 className="text-base md:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  10. User Content &amp; Profile Data
                </h3>
              </div>
              <div className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-2">
                <p>
                  You retain ownership of any profile picture, display name, biography text, and messages you submit (&quot;User Content&quot;).
                </p>
                <p>
                  By submitting User Content to the Application, you grant us a worldwide, non-exclusive, royalty-free license strictly necessary to store, transmit, format, and display such content to enable your communications on the platform. You represent and warrant that your User Content does not violate any third-party intellectual property or privacy rights.
                </p>
              </div>
            </section>

            {/* Section 11: Account Suspension & Termination */}
            <section id="suspension-termination" className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="text-base md:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  11. Account Suspension &amp; Termination
                </h3>
              </div>
              <div className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-2">
                <p>
                  We reserve the right, in our sole discretion and without prior notice, to temporarily suspend or permanently terminate your account and access to the Application if:
                </p>
                <ul className="space-y-1.5 list-disc list-inside pl-1 text-xs">
                  <li>You violate any provision of these Terms &amp; Conditions.</li>
                  <li>We receive substantiated reports of harassment, abusive video/audio calling, or scam activity.</li>
                  <li>Required to do so by applicable legal processes or governmental authorities.</li>
                  <li>Your conduct creates liability, harm, or security risks for the platform or other users.</li>
                </ul>
              </div>
            </section>

            {/* Section 12: Intellectual Property */}
            <section id="intellectual-property" className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5 text-indigo-600 dark:text-indigo-400">
                <Scale className="w-5 h-5" />
                <h3 className="text-base md:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  12. Intellectual Property
                </h3>
              </div>
              <div className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-2">
                <p>
                  The Application interface, design layouts, visual styles, branding assets, code, and documentation are owned by or licensed to the operators of LiveConnect and are protected by copyright, trademark, and intellectual property laws. You may not copy, modify, distribute, sell, or lease any part of the service unless explicitly authorized in writing.
                </p>
              </div>
            </section>

            {/* Section 13: Third-Party Services */}
            <section id="third-party-services" className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5 text-indigo-600 dark:text-indigo-400">
                <ExternalLink className="w-5 h-5" />
                <h3 className="text-base md:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  13. Third-Party Services
                </h3>
              </div>
              <div className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-2">
                <p>
                  The Application relies on third-party service providers to deliver functionality:
                </p>
                <ul className="space-y-1.5 list-disc list-inside pl-1 text-xs">
                  <li><strong>Supabase:</strong> For backend database storage, user authentication, and real-time message &amp; call signal synchronization.</li>
                  <li><strong>WebRTC Standards:</strong> For peer-to-peer 1-to-1 audio and video streaming using browser WebRTC standards.</li>
                </ul>
                <p className="text-xs text-neutral-500">
                  Your use of the Application may be subject to the terms and privacy practices of these respective third-party infrastructure providers.
                </p>
              </div>
            </section>

            {/* Section 14: Service Availability */}
            <section id="service-availability" className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5 text-indigo-600 dark:text-indigo-400">
                <Server className="w-5 h-5" />
                <h3 className="text-base md:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  14. Service Availability &amp; Modifications
                </h3>
              </div>
              <div className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-2">
                <p>
                  We strive to maintain continuous uptime and reliable call quality; however, we do not guarantee that the Application will always be uninterrupted, error-free, or entirely bug-free. We reserve the right to modify, upgrade, suspend, or discontinue any feature or component of the service at any time with or without prior notice.
                </p>
              </div>
            </section>

            {/* Section 15: Disclaimer */}
            <section id="disclaimer" className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-base md:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  15. Disclaimer of Warranties
                </h3>
              </div>
              <div className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-2">
                <p className="uppercase text-[11px] font-bold tracking-wide text-neutral-700 dark:text-neutral-300">
                  THE APPLICATION IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED.
                </p>
                <p>
                  To the maximum extent permitted by applicable law, we disclaim all warranties, express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement.
                </p>
                <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-200">
                  <strong>Important Notice on Emergency Calling:</strong> This Application is a real-time web communication utility and is <strong>NOT</strong> a replacement for conventional telephone service. It cannot be used to place emergency calls (such as 911, 112, or 999) to emergency services or first responders.
                </div>
              </div>
            </section>

            {/* Section 16: Limitation of Liability */}
            <section id="limitation-liability" className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5 text-indigo-600 dark:text-indigo-400">
                <Scale className="w-5 h-5" />
                <h3 className="text-base md:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  16. Limitation of Liability
                </h3>
              </div>
              <div className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-2">
                <p>
                  To the fullest extent permitted by law, in no event shall the operators, contributors, or service hosts of LiveConnect be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of data, profits, goodwill, or communication disruptions arising out of or related to your use of or inability to use the Application.
                </p>
              </div>
            </section>

            {/* Section 17: Account Deletion */}
            <section id="account-deletion" className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
                <Trash2 className="w-5 h-5" />
                <h3 className="text-base md:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  17. Account Deletion &amp; Termination by User
                </h3>
              </div>
              <div className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-2.5">
                <p>
                  You may stop using the Application at any time. You may request deletion of your account and personal records by submitting an inquiry via <strong>Help Center &rarr; 7. Contact Support</strong> or contacting us directly via email. Upon account deletion, your right to access the service terminates immediately.
                </p>
              </div>
            </section>

            {/* Section 18: Changes to Terms */}
            <section id="changes-terms" className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5 text-indigo-600 dark:text-indigo-400">
                <FileText className="w-5 h-5" />
                <h3 className="text-base md:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  18. Changes to Terms of Use
                </h3>
              </div>
              <div className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-2">
                <p>
                  We may modify these Terms of Use periodically. Changes take effect upon posting to the Application with an updated <em>&quot;Last Updated&quot;</em> timestamp. Your continued use of the Application after revisions signifies your acceptance of the revised Terms.
                </p>
              </div>
            </section>

            {/* Section 19: Contact Us */}
            <section id="contact-us" className="p-6 md:p-8 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 text-indigo-600 dark:text-indigo-400">
                <Mail className="w-5 h-5" />
                <h3 className="text-base md:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  19. Contact Us &amp; Inquiries
                </h3>
              </div>
              <div className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-3">
                <p>
                  If you have questions, notices, or concerns regarding these Terms of Use, please reach out to our team:
                </p>

                <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/60 space-y-3">
                  <div className="space-y-1">
                    <p className="font-bold text-neutral-900 dark:text-neutral-100">Official Support Contact</p>
                    <a
                      href="mailto:ravikantsharma925490@gmail.com"
                      className="inline-flex items-center gap-1.5 font-mono text-sm text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                    >
                      <span>ravikantsharma925490@gmail.com</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <a
                      href="https://mail.google.com/mail/?view=cm&fs=1&to=ravikantsharma925490@gmail.com&su=Terms%20and%20Conditions%20Inquiry%20-%20LiveConnect"
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
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
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
                className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
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
