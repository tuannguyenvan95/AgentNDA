import React, { useState } from 'react';
import {
  ExternalLink,
  Sparkles,
  ArrowRight,
  Loader2,
  X,
  AlertOctagon,
  ShieldCheck,
} from 'lucide-react';
import { reportLeakOnChain, NDACaseData } from '../config/genlayer';
import { formatGen, formatAddress } from '../utils/helpers';

interface ReportLeakProps {
  caseData: NDACaseData | null;
  contractAddress: string;
  account: string | null;
  onClose: () => void;
  onSuccess: () => void;
  onTxStart: (title: string, desc: string) => void;
  onTxEnd: () => void;
}

const PRESET_LEAK_URLS = [
  {
    label: 'Pastebin Public Leak (High Exposure)',
    url: 'https://pastebin.com/raw/CANARY_LEAK_EVIDENCE_998',
  },
  {
    label: 'Twitter/X Unauthorized Disclosure Thread',
    url: 'https://twitter.com/whistleblower_alpha/status/178901234567890',
  },
  {
    label: 'GitHub Gist Leaked Credentials & Memo',
    url: 'https://gist.githubusercontent.com/raw/agentnda_confidential_leak.txt',
  },
];

export const ReportLeak: React.FC<ReportLeakProps> = ({
  caseData,
  contractAddress,
  account,
  onClose,
  onSuccess,
  onTxStart,
  onTxEnd,
}) => {
  const [evidenceUrl, setEvidenceUrl] = useState(PRESET_LEAK_URLS[0].url);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!caseData) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) {
      setErrorMsg('Please connect your MetaMask wallet first to receive whistleblower bounty.');
      return;
    }

    if (!evidenceUrl.trim().startsWith('http://') && !evidenceUrl.trim().startsWith('https://')) {
      setErrorMsg('Valid HTTP/HTTPS public evidence URL is required.');
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);
    onTxStart(
      'Submitting Whistleblower Evidence',
      `Filing leak URL for Docket ${caseData.case_id}. Bồi thẩm đoàn AI will convene on Studionet.`
    );

    try {
      await reportLeakOnChain(contractAddress, account, caseData.case_id, evidenceUrl);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error reporting leak:', err);
      setErrorMsg(err.message || 'Transaction failed.');
    } finally {
      setIsSubmitting(false);
      onTxEnd();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-2xl bg-[#FFFFFF] border border-[#E5E5E0] rounded-xl p-6 sm:p-8 shadow-xl space-y-5 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 text-[#6B7280] hover:text-[#111827] transition p-1 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title & Badge */}
        <div className="border-b border-[#E5E5E0] pb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="press-tag press-tag-crimson text-[10px]">
              WHISTLEBLOWER TELEGRAPH
            </span>
            <span className="text-xs font-mono text-[#B91C1C] font-semibold">URGENT DISCLOSURE</span>
          </div>
          <h3 className="font-serif font-bold text-2xl text-[#111827]">
            File Leak Report & Claim Bounty Bond
          </h3>
          <p className="mt-1 text-xs text-[#4B5563]">
            Submit public web evidence showing breach of confidential information under this docket.
          </p>
        </div>

        {/* Target Docket Summary */}
        <div className="p-3.5 rounded-lg bg-[#F9F8F6] border border-[#E5E5E0] space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[#6B7280] uppercase tracking-wider font-semibold text-[10px]">Target Docket:</span>
            <span className="font-mono font-bold text-[#111827]">{caseData.case_id}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#6B7280] uppercase tracking-wider font-semibold text-[10px]">Bond Reward:</span>
            <span className="font-serif font-bold text-base text-[#15803D]">
              {formatGen(caseData.bounty_amount)} GEN
            </span>
          </div>
          <div className="pt-1.5 border-t border-[#E5E5E0] text-[11px]">
            <span className="font-semibold text-[#4B5563]">Canary / Protected Criteria:</span>
            <p className="mt-0.5 font-mono text-[#374151] line-clamp-2">{caseData.nda_scope}</p>
          </div>
        </div>

        {/* Presets */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#111827] uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#B91C1C]" />
            <span>Sample Leak Evidence Links for Testing:</span>
          </label>
          <div className="space-y-1.5">
            {PRESET_LEAK_URLS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setEvidenceUrl(preset.url)}
                className="w-full text-left px-3 py-2 rounded-md bg-[#F9F8F6] border border-[#E5E5E0] hover:border-[#111827] hover:bg-[#F3F4F6] text-xs text-[#374151] flex items-center justify-between transition cursor-pointer"
              >
                <span className="font-semibold text-[#111827]">{preset.label}</span>
                <span className="font-mono text-[10px] text-[#6B7280] truncate max-w-[240px]">
                  {preset.url}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Evidence URL Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#111827] uppercase tracking-wider">
              Public Evidence URL (Pastebin, Twitter/X, Blog, Forum)
            </label>
            <div className="relative">
              <input
                type="url"
                required
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
                placeholder="https://pastebin.com/raw/..."
                className="w-full px-3 py-2 bg-[#F9F8F6] border border-[#E5E5E0] rounded-md text-xs font-mono text-[#111827] focus:outline-none focus:border-[#111827] focus:bg-[#FFFFFF] pr-10"
              />
              <ExternalLink className="w-4 h-4 text-[#9CA3AF] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <p className="text-[11px] text-[#6B7280]">
              ⚡ GenLayer validators will scrape this link directly via <code>gl.nondet.web.render</code> on-chain.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-md bg-[#FEF2F2] border border-[#FCA5A5] text-xs text-[#B91C1C] flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="p-3 rounded-md bg-[#F0FDF4] border border-[#86EFAC] text-xs text-[#166534] flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-[#15803D] flex-shrink-0 mt-0.5" />
            <span>
              <strong>Bounty Guarantee:</strong> Upon confirmed breach consensus, the smart contract
              autonomously transfers 100% of the bounty to your wallet (
              <span className="font-mono font-bold">{formatAddress(account || '')}</span>).
            </span>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-md bg-[#F3F4F6] hover:bg-[#E5E5E0] text-xs font-medium text-[#374151] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !account}
              className="px-5 py-2 rounded-md bg-[#B91C1C] hover:bg-[#991B1B] text-white text-xs font-bold uppercase tracking-wide shadow-sm flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting to Studionet...</span>
                </>
              ) : (
                <>
                  <span>File Leak Report</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
