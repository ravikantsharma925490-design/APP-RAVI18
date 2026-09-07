import React from 'react';
import { X } from 'lucide-react';

interface TermsAgreementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAgree: () => void;
  onOpenLegalDoc: (tab: 'terms' | 'privacy') => void;
}

export const TermsAgreementModal: React.FC<TermsAgreementModalProps> = ({
  isOpen,
  onClose,
  onAgree,
  onOpenLegalDoc,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white text-neutral-900 w-full max-w-sm rounded-3xl p-7 shadow-2xl relative flex flex-col items-center text-center animate-in zoom-in-95 duration-150 border border-neutral-100">
        {/* Top Close Button (✕) */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Big Headline */}
        <h2 className="text-2xl font-extrabold text-neutral-900 tracking-tight mt-2 mb-3">
          Please read and agree
        </h2>

        {/* Terms & Privacy Links and Explanation */}
        <div className="text-xs text-neutral-600 leading-relaxed max-w-xs mb-8 space-y-1.5">
          <p>
            <button
              type="button"
              onClick={() => onOpenLegalDoc('terms')}
              className="text-neutral-900 font-semibold underline underline-offset-2 hover:text-indigo-600 transition-colors cursor-pointer"
            >
              Terms of use
            </button>{' '}
            and{' '}
            <button
              type="button"
              onClick={() => onOpenLegalDoc('privacy')}
              className="text-neutral-900 font-semibold underline underline-offset-2 hover:text-indigo-600 transition-colors cursor-pointer"
            >
              Privacy policy
            </button>
          </p>
          <p className="text-neutral-500 font-normal text-[13px] leading-snug">
            Your info will only be used for create account. We never leak user privacy.
          </p>
        </div>

        {/* Primary Purple/Indigo Pill Action Button */}
        <button
          type="button"
          onClick={onAgree}
          className="w-full py-3.5 px-6 rounded-full bg-[#6355ff] hover:bg-[#5244e8] active:bg-[#4336d3] text-white font-bold text-sm shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
        >
          Agree and continue
        </button>
      </div>
    </div>
  );
};
