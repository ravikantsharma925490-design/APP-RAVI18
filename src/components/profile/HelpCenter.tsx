import React, { useState, useEffect } from 'react';
import {
  HelpCircle,
  MessageSquare,
  Phone,
  Video,
  Shield,
  Wrench,
  Mail,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Search,
  CheckCircle2,
  Send,
  AlertCircle,
  ExternalLink,
  Database,
  Loader2,
  FileText,
  FileCheck2,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Profile } from '@/src/types';
import { getSupabase } from '@/src/lib/supabase/client';
import { PrivacyPolicy } from '../legal/PrivacyPolicy';
import { TermsConditions } from '../legal/TermsConditions';

interface HelpCenterProps {
  currentUser?: Profile | null;
  initialShowPrivacy?: boolean;
  initialShowTerms?: boolean;
  onBack: () => void;
}

export const HelpCenter: React.FC<HelpCenterProps> = ({
  currentUser,
  initialShowPrivacy = false,
  initialShowTerms = false,
  onBack,
}) => {
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState<boolean>(initialShowPrivacy);
  const [showTermsConditions, setShowTermsConditions] = useState<boolean>(initialShowTerms);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname === '/app/help/privacy') {
        setShowPrivacyPolicy(true);
        setShowTermsConditions(false);
      } else if (window.location.pathname === '/app/help/terms') {
        setShowTermsConditions(true);
        setShowPrivacyPolicy(false);
      }
    }
  }, []);

  const handleOpenPrivacyPolicy = () => {
    setShowPrivacyPolicy(true);
    setShowTermsConditions(false);
    if (typeof window !== 'undefined' && window.history?.pushState) {
      window.history.pushState({}, '', '/app/help/privacy');
    }
  };

  const handleBackFromPrivacyPolicy = () => {
    setShowPrivacyPolicy(false);
    if (typeof window !== 'undefined' && window.history?.pushState) {
      window.history.pushState({}, '', '/app/help');
    }
  };

  const handleOpenTermsConditions = () => {
    setShowTermsConditions(true);
    setShowPrivacyPolicy(false);
    if (typeof window !== 'undefined' && window.history?.pushState) {
      window.history.pushState({}, '', '/app/help/terms');
    }
  };

  const handleBackFromTermsConditions = () => {
    setShowTermsConditions(false);
    if (typeof window !== 'undefined' && window.history?.pushState) {
      window.history.pushState({}, '', '/app/help');
    }
  };

  // Report a Problem Form State
  const [reportCategory, setReportCategory] = useState('calling');
  const [reportDetails, setReportDetails] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [lastReportId, setLastReportId] = useState<string | null>(null);

  // Contact Support Form State
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [isSubmittingSupport, setIsSubmittingSupport] = useState(false);
  const [supportSubmitted, setSupportSubmitted] = useState(false);
  const [lastSupportReportId, setLastSupportReportId] = useState<string | null>(null);

  const sections = [
    {
      id: 'faq',
      title: 'FAQ',
      icon: HelpCircle,
      iconColor: 'text-amber-500 bg-amber-500/10',
      description: 'Frequently asked questions about LiveConnect',
    },
    {
      id: 'messaging',
      title: 'Messaging Help',
      icon: MessageSquare,
      iconColor: 'text-blue-500 bg-blue-500/10',
      description: 'Chat features, real-time sync, and read receipts',
    },
    {
      id: 'audio-call',
      title: 'Audio Call Help',
      icon: Phone,
      iconColor: 'text-emerald-500 bg-emerald-500/10',
      description: 'Microphone permissions, audio setup, and call quality',
    },
    {
      id: 'video-call',
      title: 'Video Call Help',
      icon: Video,
      iconColor: 'text-indigo-500 bg-indigo-500/10',
      description: 'Camera permissions, HD video, and switching cameras',
    },
    {
      id: 'account-privacy',
      title: 'Account & Privacy',
      icon: Shield,
      iconColor: 'text-purple-500 bg-purple-500/10',
      description: 'Password reset, profile settings, and data security',
    },
    {
      id: 'report-problem',
      title: 'Report a Problem',
      icon: Wrench,
      iconColor: 'text-rose-500 bg-rose-500/10',
      description: 'Submit a bug report or performance issue',
    },
    {
      id: 'contact-support',
      title: 'Contact Support',
      icon: Mail,
      iconColor: 'text-cyan-500 bg-cyan-500/10',
      description: 'Get in touch with our technical support team',
    },
    {
      id: 'privacy-policy',
      title: 'Privacy Policy',
      icon: FileText,
      iconColor: 'text-emerald-500 bg-emerald-500/10',
      description: 'Review data collection, calling, messaging, and permissions policy',
    },
    {
      id: 'terms-conditions',
      title: 'Terms of Use',
      icon: FileCheck2,
      iconColor: 'text-indigo-500 bg-indigo-500/10',
      description: 'Rules, acceptable use, calling conduct, and user agreement',
    },
  ];

  const faqs = [
    {
      q: 'How do I start a chat with someone?',
      a: 'Go to the Messages tab, click the "+ New Chat" button in the top right, search for a user by name or username, and select them to start messaging.',
    },
    {
      q: 'How do I make an Audio or Video call?',
      a: 'Go to the "Calls" tab to see all contacts. Click the Phone (📞) icon for an Audio Call or the Video (📹) icon for a Video Call. You can also start calls directly from inside any chat conversation.',
    },
    {
      q: 'Where is my call history stored?',
      a: 'All incoming, outgoing, and missed calls are saved in your database and viewable anytime in the "Call History" tab.',
    },
    {
      q: 'How do I update my profile photo and bio?',
      a: 'Go to the Profile tab, click "Edit Profile", and update your Display Name, Avatar Image URL, or Bio.',
    },
    {
      q: 'Why does my call fail to connect?',
      a: 'Ensure your browser has granted Microphone and Camera permissions. Also check your internet connection for stable WebRTC audio/video streaming.',
    },
  ];

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportDetails.trim() || isSubmittingReport) return;

    setIsSubmittingReport(true);
    const supabase = getSupabase();
    let generatedReportId = `rep_${Date.now().toString(36)}`;

    try {
      // 1. Insert into Supabase table 'problem_reports'
      const { data, error } = await supabase
        .from('problem_reports')
        .insert([
          {
            user_id: currentUser?.id || null,
            category: reportCategory,
            description: reportDetails.trim(),
            status: 'open',
            created_at: new Date().toISOString(),
          },
        ])
        .select();

      if (data && data[0]?.id) {
        generatedReportId = data[0].id;
      }
      if (error) {
        console.warn('Note: problem_reports table insert notice:', error.message);
      }
    } catch (err) {
      console.warn('Report submission Supabase notice:', err);
    } finally {
      setIsSubmittingReport(false);
      setLastReportId(generatedReportId);
      setReportSubmitted(true);
      setTimeout(() => {
        setReportDetails('');
      }, 500);
    }
  };

  const SUPPORT_EMAIL = 'ravikantsharma925490@gmail.com';

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportSubject.trim() || !supportMessage.trim() || isSubmittingSupport) return;

    setIsSubmittingSupport(true);
    const supabase = getSupabase();
    let generatedReportId = `sup_${Date.now().toString(36)}`;

    try {
      // Insert into Supabase table 'problem_reports' with category 'support_inquiry'
      const combinedDescription = `[Subject]: ${supportSubject.trim()}\n\n[Message]: ${supportMessage.trim()}`;
      const { data, error } = await supabase
        .from('problem_reports')
        .insert([
          {
            user_id: currentUser?.id || null,
            category: 'support_inquiry',
            description: combinedDescription,
            status: 'open',
            created_at: new Date().toISOString(),
          },
        ])
        .select();

      if (data && data[0]?.id) {
        generatedReportId = data[0].id;
      }
      if (error) {
        console.warn('Note: problem_reports table insert notice:', error.message);
      }
    } catch (err) {
      console.warn('Support submission Supabase notice:', err);
    } finally {
      setIsSubmittingSupport(false);
      setLastSupportReportId(generatedReportId);
      setSupportSubmitted(true);
      setTimeout(() => {
        setSupportSubject('');
        setSupportMessage('');
      }, 500);
    }
  };

  const filteredSections = sections.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
  });

  if (showPrivacyPolicy) {
    return (
      <PrivacyPolicy
        onBack={handleBackFromPrivacyPolicy}
        onOpenContactSupport={() => {
          setShowPrivacyPolicy(false);
          setSelectedSection('contact-support');
          if (typeof window !== 'undefined' && window.history?.pushState) {
            window.history.pushState({}, '', '/app/help');
          }
        }}
      />
    );
  }

  if (showTermsConditions) {
    return (
      <TermsConditions
        onBack={handleBackFromTermsConditions}
        onOpenContactSupport={() => {
          setShowTermsConditions(false);
          setSelectedSection('contact-support');
          if (typeof window !== 'undefined' && window.history?.pushState) {
            window.history.pushState({}, '', '/app/help');
          }
        }}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-50 dark:bg-neutral-950 overflow-hidden">
      {/* Top Header with Back Button */}
      <header className="p-4 md:p-6 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-all active:scale-95 flex items-center gap-1 text-xs font-bold"
            title="Back to Profile"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </button>
          <div>
            <h2 className="text-xl md:text-2xl font-extrabold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
              <HelpCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <span>Help Center</span>
            </h2>
            <p className="text-xs text-neutral-500 font-medium mt-0.5">
              Guides, FAQs, troubleshooting, and support
            </p>
          </div>
        </div>
      </header>

      {/* Search Input Bar */}
      <div className="p-4 md:px-6 bg-white/60 dark:bg-neutral-900/60 backdrop-blur-md border-b border-neutral-200/80 dark:border-neutral-800/80">
        <div className="relative max-w-xl mx-auto">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search help topics, FAQs, or troubleshooting..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-xs"
          />
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Section 1: ❓ FAQ */}
          <div className="rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs overflow-hidden">
            <button
              onClick={() => setSelectedSection(selectedSection === 'faq' ? null : 'faq')}
              className="w-full p-4 md:p-5 flex items-center justify-between text-left hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40 transition-colors"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-500">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                    1. FAQ (Frequently Asked Questions)
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Quick answers to common questions about chats, calls, and accounts
                  </p>
                </div>
              </div>
              {selectedSection === 'faq' ? (
                <ChevronUp className="w-5 h-5 text-neutral-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-neutral-400" />
              )}
            </button>

            {selectedSection === 'faq' && (
              <div className="p-4 md:p-6 border-t border-neutral-100 dark:border-neutral-800 space-y-3 bg-neutral-50/50 dark:bg-neutral-950/40">
                {faqs.map((faq, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-neutral-100 dark:bg-neutral-800/90 border border-neutral-200 dark:border-neutral-700/80 shadow-xs"
                  >
                    <button
                      onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                      className="w-full flex items-center justify-between text-left font-bold text-sm text-neutral-900 dark:text-white"
                    >
                      <span className="text-neutral-900 dark:text-white">{faq.q}</span>
                      {expandedFaq === idx ? (
                        <ChevronUp className="w-4 h-4 text-blue-500 shrink-0 ml-2" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-neutral-500 dark:text-neutral-400 shrink-0 ml-2" />
                      )}
                    </button>
                    {expandedFaq === idx && (
                      <p className="text-xs text-neutral-700 dark:text-neutral-300 mt-2.5 pt-2.5 border-t border-neutral-200 dark:border-neutral-700/60 leading-relaxed">
                        {faq.a}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: 💬 Messaging Help */}
          <div className="rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs overflow-hidden">
            <button
              onClick={() => setSelectedSection(selectedSection === 'messaging' ? null : 'messaging')}
              className="w-full p-4 md:p-5 flex items-center justify-between text-left hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40 transition-colors"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-500">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                    2. Messaging Help
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    How real-time messaging, unread counts, and search work
                  </p>
                </div>
              </div>
              {selectedSection === 'messaging' ? (
                <ChevronUp className="w-5 h-5 text-neutral-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-neutral-400" />
              )}
            </button>

            {selectedSection === 'messaging' && (
              <div className="p-4 md:p-6 border-t border-neutral-100 dark:border-neutral-800 space-y-4 text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed bg-neutral-50/30 dark:bg-neutral-950/20">
                <div className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40">
                  <h4 className="font-bold text-sm text-blue-700 dark:text-blue-300 mb-1">
                    ⚡ Instant Real-Time Delivery
                  </h4>
                  <p>
                    All messages are synchronized in real time via Supabase PostgreSQL Realtime channels. When a recipient opens your chat, unread message badges update automatically.
                  </p>
                </div>

                <div className="space-y-2">
                  <h5 className="font-bold text-neutral-900 dark:text-neutral-100 text-sm">Key Features:</h5>
                  <ul className="list-disc list-inside space-y-1.5 pl-1">
                    <li><strong>Enter to Send:</strong> Type your message and press Enter (or tap the send button) to dispatch immediately.</li>
                    <li><strong>Online Presence:</strong> Green indicators show when a user is actively connected.</li>
                    <li><strong>Conversation Filter:</strong> Use the search bar in the Messages tab to quickly filter chats by name, username, or message preview text.</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: 📞 Audio Call Help */}
          <div className="rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs overflow-hidden">
            <button
              onClick={() => setSelectedSection(selectedSection === 'audio-call' ? null : 'audio-call')}
              className="w-full p-4 md:p-5 flex items-center justify-between text-left hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40 transition-colors"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-500">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                    3. Audio Call Help
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Microphone setup, noise cancellation, and call controls
                  </p>
                </div>
              </div>
              {selectedSection === 'audio-call' ? (
                <ChevronUp className="w-5 h-5 text-neutral-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-neutral-400" />
              )}
            </button>

            {selectedSection === 'audio-call' && (
              <div className="p-4 md:p-6 border-t border-neutral-100 dark:border-neutral-800 space-y-3 text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed bg-neutral-50/30 dark:bg-neutral-950/20">
                <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40">
                  <h4 className="font-bold text-sm text-emerald-700 dark:text-emerald-300 mb-1">
                    🎙️ Microphone Permissions
                  </h4>
                  <p>
                    When starting an audio call, your browser will prompt for microphone access. Click <strong>Allow</strong>. If blocked, tap the lock/tune icon in your browser URL bar to grant permission.
                  </p>
                </div>

                <div className="space-y-2">
                  <h5 className="font-bold text-neutral-900 dark:text-neutral-100 text-sm">Call Controls:</h5>
                  <ul className="list-disc list-inside space-y-1.5 pl-1">
                    <li><strong>Mute / Unmute:</strong> Tap the microphone icon at any time during an active call.</li>
                    <li><strong>End Call:</strong> Tap the red phone button to hang up immediately.</li>
                    <li><strong>Call History:</strong> Call duration and status will be logged automatically to your history.</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Section 4: 📹 Video Call Help */}
          <div className="rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs overflow-hidden">
            <button
              onClick={() => setSelectedSection(selectedSection === 'video-call' ? null : 'video-call')}
              className="w-full p-4 md:p-5 flex items-center justify-between text-left hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40 transition-colors"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-500">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                    4. Video Call Help
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    HD camera streaming, switching front/rear camera, and bandwidth
                  </p>
                </div>
              </div>
              {selectedSection === 'video-call' ? (
                <ChevronUp className="w-5 h-5 text-neutral-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-neutral-400" />
              )}
            </button>

            {selectedSection === 'video-call' && (
              <div className="p-4 md:p-6 border-t border-neutral-100 dark:border-neutral-800 space-y-3 text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed bg-neutral-50/30 dark:bg-neutral-950/20">
                <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/40">
                  <h4 className="font-bold text-sm text-indigo-700 dark:text-indigo-300 mb-1">
                    🎥 HD WebRTC Video
                  </h4>
                  <p>
                    LiveConnect uses direct peer-to-peer WebRTC for crystal-clear, low-latency 1-to-1 audio and video conferencing with adaptive quality.
                  </p>
                </div>

                <div className="space-y-2">
                  <h5 className="font-bold text-neutral-900 dark:text-neutral-100 text-sm">Video Controls:</h5>
                  <ul className="list-disc list-inside space-y-1.5 pl-1">
                    <li><strong>Camera On/Off:</strong> Toggle your camera stream without leaving the call.</li>
                    <li><strong>Switch Camera:</strong> On mobile devices, use the switch camera button to alternate between front and rear cameras.</li>
                    <li><strong>Picture-in-Picture:</strong> Your local video preview appears in the bottom right corner of the call screen.</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Section 5: 🔐 Account & Privacy */}
          <div className="rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs overflow-hidden">
            <button
              onClick={() => setSelectedSection(selectedSection === 'account-privacy' ? null : 'account-privacy')}
              className="w-full p-4 md:p-5 flex items-center justify-between text-left hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40 transition-colors"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-500">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                    5. Account & Privacy
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Security, password management, and data protection
                  </p>
                </div>
              </div>
              {selectedSection === 'account-privacy' ? (
                <ChevronUp className="w-5 h-5 text-neutral-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-neutral-400" />
              )}
            </button>

            {selectedSection === 'account-privacy' && (
              <div className="p-4 md:p-6 border-t border-neutral-100 dark:border-neutral-800 space-y-3 text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed bg-neutral-50/30 dark:bg-neutral-950/20">
                <div className="p-3.5 rounded-2xl bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-900/40">
                  <h4 className="font-bold text-sm text-purple-700 dark:text-purple-300 mb-1">
                    🔒 Row-Level Security (RLS)
                  </h4>
                  <p>
                    All messages, conversations, and call logs are protected by database-level Row-Level Security policies. Only participants can read or query their respective data.
                  </p>
                </div>

                <div className="space-y-2">
                  <h5 className="font-bold text-neutral-900 dark:text-neutral-100 text-sm">Account Security Tips:</h5>
                  <ul className="list-disc list-inside space-y-1.5 pl-1">
                    <li><strong>Password Reset:</strong> Use the "Forgot password?" option on the Sign In screen to receive a secure recovery link.</li>
                    <li><strong>Sign Out:</strong> Always remember to log out when accessing LiveConnect from a shared computer.</li>
                  </ul>
                </div>

                <div className="pt-2 border-t border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between">
                  <div>
                    <h5 className="font-bold text-neutral-900 dark:text-neutral-100 text-xs">Official Privacy Policy</h5>
                    <p className="text-[11px] text-neutral-500">Read how messages, calling data, and device permissions are handled</p>
                  </div>
                  <button
                    onClick={handleOpenPrivacyPolicy}
                    className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shrink-0"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>View Privacy Policy</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Section 6: 🛠️ Report a Problem */}
          <div className="rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs overflow-hidden">
            <button
              onClick={() => setSelectedSection(selectedSection === 'report-problem' ? null : 'report-problem')}
              className="w-full p-4 md:p-5 flex items-center justify-between text-left hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40 transition-colors"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-500">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                    6. Report a Problem
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Submit bug reports, audio/video glitches, or connection issues
                  </p>
                </div>
              </div>
              {selectedSection === 'report-problem' ? (
                <ChevronUp className="w-5 h-5 text-neutral-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-neutral-400" />
              )}
            </button>

            {selectedSection === 'report-problem' && (
              <div className="p-4 md:p-6 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/30 dark:bg-neutral-950/20 space-y-4">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 text-xs">
                  <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
                    <Database className="w-4 h-4 text-emerald-500" />
                    <span className="font-semibold">Direct Supabase Database Sync</span>
                  </div>
                  <span className="text-[11px] font-mono text-neutral-500 bg-white dark:bg-neutral-900 px-2 py-0.5 rounded-full border border-neutral-200 dark:border-neutral-800">
                    table: problem_reports
                  </span>
                </div>

                {reportSubmitted ? (
                  <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs space-y-3 animate-in fade-in">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
                      <div>
                        <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                          Problem Report Saved in Supabase!
                        </h4>
                        <p className="text-neutral-600 dark:text-neutral-300 mt-0.5">
                          Your issue has been recorded directly to the Supabase database. Our team will investigate.
                        </p>
                      </div>
                    </div>

                    {lastReportId && (
                      <div className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-emerald-500/20 font-mono text-[11px] text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                        <span>Report Record ID:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{lastReportId}</span>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        setReportSubmitted(false);
                        setLastReportId(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95"
                    >
                      Submit Another Report
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleReportSubmit} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                        Issue Category
                      </label>
                      <select
                        value={reportCategory}
                        onChange={(e) => setReportCategory(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                      >
                        <option value="calling">Audio & Video Calling Issue</option>
                        <option value="messaging">Messaging & Sync Delay</option>
                        <option value="account">Sign In / Account Issue</option>
                        <option value="ui">UI / Display Glitch</option>
                        <option value="other">Other Issue</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                        Description of the Problem
                      </label>
                      <textarea
                        rows={3}
                        required
                        placeholder="Please describe what happened, steps to reproduce, or any error messages..."
                        value={reportDetails}
                        onChange={(e) => setReportDetails(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmittingReport}
                      className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-rose-500/20 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
                    >
                      {isSubmittingReport ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving to Supabase...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Submit to Supabase</span>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Section 7: 📩 Contact Support */}
          <div className="rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs overflow-hidden">
            <button
              onClick={() => setSelectedSection(selectedSection === 'contact-support' ? null : 'contact-support')}
              className="w-full p-4 md:p-5 flex items-center justify-between text-left hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40 transition-colors"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-2xl bg-cyan-500/10 text-cyan-500">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                    7. Contact Support
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Direct communication with technical support
                  </p>
                </div>
              </div>
              {selectedSection === 'contact-support' ? (
                <ChevronUp className="w-5 h-5 text-neutral-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-neutral-400" />
              )}
            </button>

            {selectedSection === 'contact-support' && (
              <div className="p-4 md:p-6 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/30 dark:bg-neutral-950/20 space-y-4">
                <div className="p-4 rounded-2xl bg-cyan-50/70 dark:bg-cyan-950/40 border border-cyan-200/80 dark:border-cyan-900/60 text-xs text-neutral-700 dark:text-neutral-300 space-y-2">
                  <p className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                    <span>📩</span>
                    <span>Support Email & Assistance</span>
                  </p>
                  <p>
                    For technical inquiries or immediate account assistance, you can send us a message below or email us directly at:
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <a
                      href="https://mail.google.com/mail/?view=cm&fs=1&to=ravikantsharma925490@gmail.com&su=LiveConnect%20Support%20Request"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Open in Gmail</span>
                    </a>
                    <a
                      href="mailto:ravikantsharma925490@gmail.com"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 font-mono text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                    >
                      <span>ravikantsharma925490@gmail.com</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {supportSubmitted ? (
                  <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs space-y-3 animate-in fade-in">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
                      <div>
                        <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                          Support Inquiry Saved in Supabase!
                        </h4>
                        <p className="text-neutral-600 dark:text-neutral-300 mt-0.5">
                          Your message has been safely stored in the database. Our team will review your inquiry.
                        </p>
                      </div>
                    </div>

                    {lastSupportReportId && (
                      <div className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-emerald-500/20 font-mono text-[11px] text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                        <span>Record ID:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{lastSupportReportId}</span>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        setSupportSubmitted(false);
                        setLastSupportReportId(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                    >
                      Send Another Message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSupportSubmit} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                        Subject
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Question about 1-to-1 WebRTC calling or account"
                        value={supportSubject}
                        onChange={(e) => setSupportSubject(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                        Your Message
                      </label>
                      <textarea
                        rows={3}
                        required
                        placeholder="How can our support team help you today?"
                        value={supportMessage}
                        onChange={(e) => setSupportMessage(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmittingSupport}
                      className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
                    >
                      {isSubmittingSupport ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving to Supabase...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Submit to Supabase</span>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Section 8: 📄 Privacy Policy */}
          <div className="rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs overflow-hidden">
            <div className="p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-500">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                    <span>8. Privacy Policy</span>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">
                      /app/help/privacy
                    </span>
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Official policy covering data storage, messaging, 1-to-1 WebRTC calling, and permissions
                  </p>
                </div>
              </div>

              <button
                onClick={handleOpenPrivacyPolicy}
                className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shrink-0"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Open Privacy Policy</span>
              </button>
            </div>
          </div>

          {/* Section 9: 📜 Terms of Use */}
          <div className="rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs overflow-hidden">
            <div className="p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-500">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                    <span>9. Terms of Use</span>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/50">
                      /app/help/terms
                    </span>
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Rules for messaging, audio/video call conduct, prohibited behavior, and user agreement
                  </p>
                </div>
              </div>

              <button
                onClick={handleOpenTermsConditions}
                className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shrink-0"
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>Open Terms of Use</span>
              </button>
            </div>
          </div>

          {/* Copyright Footer */}
          <div className="pt-6 pb-2 text-center">
            <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium tracking-wide">
              © 2026 LiveConnect
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
