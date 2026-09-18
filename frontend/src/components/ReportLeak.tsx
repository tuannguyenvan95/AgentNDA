import React, { useState } from 'react';
import {
  AlertTriangle,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  ArrowRight,
  Loader2,
  X,
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
    label: 'Pastebin Raw Leak (High Severity)',
    url: 'https://pastebin.com/raw/CANARY_LEAK_EVIDENCE_998',
  },
  {
    label: 'Twitter/X Leak Thread',
    url: 'https://twitter.com/whistleblower_alpha/status/178901234567890',
  },
  {
    label: 'GitHub Gist Secret Snippet',
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
      'Filing Leak Report (Whistleblower)',
      `Submitting leak evidence URL for case ${caseData.case_id}. AI Jury will be convened.`
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-[#121722] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-6 top-6 text-slate-400 hover:text-white transition p-1"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title & Badge */}
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-400 mb-3">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Whistleblower Bounty Terminal</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white">
            Report NDA Leak & Claim Bounty
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            Submit public proof showing unauthorized disclosure of protected trade secrets.
          </p>
        </div>

        {/* Target Case Info */}
        <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Target NDA Case:</span>
            <span className="font-mono font-bold text-white">{caseData.case_id}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Issuer Address:</span>
            <span className="font-mono text-slate-300">{formatAddress(caseData.issuer)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Escrow Bounty Reward:</span>
            <span className="font-mono font-bold text-indigo-400 text-sm">
              {formatGen(caseData.bounty_amount)} GEN
            </span>
          </div>
          <div className="pt-2 border-t border-white/5 text-[11px] text-slate-300">
            <span className="font-semibold text-slate-400">Protected Scope Summary:</span>
            <p className="mt-1 font-mono text-slate-300 line-clamp-2">{caseData.nda_scope}</p>
          </div>
        </div>

        {/* Presets */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Sample Leak Evidence URLs for Testing:</span>
          </label>
          <div className="space-y-1.5">
            {PRESET_LEAK_URLS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setEvidenceUrl(preset.url)}
                className="w-full text-left px-3 py-2 rounded-xl bg-white/5 border border-white/5 hover:border-cyan-500/40 hover:bg-white/10 text-xs text-slate-300 flex items-center justify-between transition group"
              >
                <span className="font-medium text-white group-hover:text-cyan-300">{preset.label}</span>
                <span className="font-mono text-[10px] text-slate-500 truncate max-w-[240px]">
                  {preset.url}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">
              Live Public Evidence URL (Twitter, Pastebin, Blog, Gist)
            </label>
            <div className="relative">
              <input
                type="url"
                required
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
                placeholder="https://pastebin.com/raw/..."
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition pr-10"
              />
              <ExternalLink className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <p className="text-[11px] text-slate-400">
              ⚡ GenLayer validators will execute <code>gl.nondet.web.render</code> on this live URL to extract content.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-200">
            <strong>Bounty Guarantee:</strong> When the breach is confirmed on-chain via LLM consensus,
            the smart contract autonomously executes <code>emit_transfer</code> to your connected wallet (
            <span className="font-mono">{formatAddress(account || '')}</span>).
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !account}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white text-xs font-bold shadow-lg shadow-rose-500/20 flex items-center gap-2 transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting to GenLayer...</span>
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
