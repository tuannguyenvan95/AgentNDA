import React, { useState, useEffect } from 'react';
import {
  ExternalLink,
  Sparkles,
  ArrowRight,
  Loader2,
  X,
  AlertOctagon,
  ShieldCheck,
  Key,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { reportLeakOnChain, NDACaseData } from '../config/genlayer';
import { formatGen, formatAddress, computeSha256 } from '../utils/helpers';

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
  const [discoveredCanary, setDiscoveredCanary] = useState('');
  const [canaryMatchStatus, setCanaryMatchStatus] = useState<'idle' | 'matching' | 'mismatch'>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Validate discovered canary hash against on-chain commitment in real time
  useEffect(() => {
    if (!caseData || !discoveredCanary.trim()) {
      setCanaryMatchStatus('idle');
      return;
    }

    computeSha256(discoveredCanary.trim()).then((hash) => {
      if (caseData.canary_commitment && hash.toLowerCase() === caseData.canary_commitment.toLowerCase()) {
        setCanaryMatchStatus('matching');
      } else {
        setCanaryMatchStatus('mismatch');
      }
    });
  }, [discoveredCanary, caseData]);

  if (!caseData) return null;

  const bountyWei = BigInt(caseData.bounty_amount || '0');
  const minBondWei = bountyWei / 20n > 0n ? bountyWei / 20n : 1n;

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

    if (!discoveredCanary.trim() || discoveredCanary.trim().length < 6) {
      setErrorMsg('Secret canary token found in leak must be at least 6 characters.');
      return;
    }

    if (canaryMatchStatus === 'mismatch') {
      setErrorMsg('The entered canary token does not match the on-chain non-public commitment! Check the leaked document.');
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);
    onTxStart(
      'Submitting Whistleblower Evidence',
      `Filing leak URL & verified canary proof for Docket ${caseData.case_id} with ${formatGen(minBondWei.toString())} GEN anti-spam bond. AI jury will convene on Studionet.`
    );

    try {
      await reportLeakOnChain(
        contractAddress,
        account,
        caseData.case_id,
        evidenceUrl,
        discoveredCanary,
        minBondWei
      );
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-[#FFFFFF] border border-[#E5E5E0] rounded-xl p-6 sm:p-8 shadow-xl space-y-5 relative my-8">
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
            <span className="text-xs font-mono text-[#B91C1C] font-semibold">PROOF-OF-DISCOVERY</span>
          </div>
          <h3 className="font-serif font-bold text-2xl text-[#111827]">
            File Leak Report & Claim Bounty Bond
          </h3>
          <p className="mt-1 text-xs text-[#4B5563]">
            Submit public web evidence and the discovered canary secret proving breach by the bound NDA party.
          </p>
        </div>

        {/* Target Docket Summary */}
        <div className="p-3.5 rounded-lg bg-[#F9F8F6] border border-[#E5E5E0] space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[#6B7280] uppercase tracking-wider font-semibold text-[10px] block">Target Docket:</span>
              <span className="font-mono font-bold text-[#111827]">{caseData.case_id}</span>
            </div>
            <div>
              <span className="text-[#6B7280] uppercase tracking-wider font-semibold text-[10px] block">Bond Reward:</span>
              <span className="font-serif font-bold text-base text-[#15803D]">
                {formatGen(caseData.bounty_amount)} GEN
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-[#E5E5E0] text-[11px] space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#4B5563]">Bound NDA Counterparty:</span>
              <span className="font-mono text-[#111827]">{caseData.party_identifier || formatAddress(caseData.nda_party)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#4B5563]">Protected Subject Matter:</span>
              <span className="text-[#111827] font-medium">{caseData.public_nda_topic || caseData.nda_scope}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#4B5563]">On-Chain Hash Commitment:</span>
              <span className="font-mono text-[10px] text-[#6B7280] truncate max-w-[260px]">{caseData.canary_commitment || 'Verified on-chain'}</span>
            </div>
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
              Public Evidence URL (Established Blog, Twitter/X, GitHub Commit, Web Archive)
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
              ⚡ GenLayer validators scrape this link directly via <code>gl.nondet.web.render</code> on-chain to verify provenance & canary presence.
            </p>
          </div>

          {/* Discovered Canary Token Input with Proof-of-Discovery Validation */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#111827] uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-[#B91C1C]" />
                <span>Discovered Canary Token (From Leaked Document)</span>
              </span>
              <span className="text-[10px] font-normal text-[#6B7280]">
                Cryptographic Proof-of-Discovery
              </span>
            </label>
            <input
              type="text"
              required
              value={discoveredCanary}
              onChange={(e) => setDiscoveredCanary(e.target.value)}
              placeholder="e.g. CANARY_SEC_..."
              className="w-full px-3 py-2 bg-[#F9F8F6] border border-[#E5E5E0] rounded-md text-xs font-mono text-[#111827] focus:outline-none focus:border-[#111827] focus:bg-[#FFFFFF]"
            />

            {/* Proof-of-discovery status indicator */}
            {canaryMatchStatus === 'matching' && (
              <div className="p-2 rounded bg-[#F0FDF4] border border-[#86EFAC] text-[11px] text-[#166534] flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" />
                <span>Cryptographic Proof Confirmed: Discovered canary matches the on-chain SHA-256 commitment!</span>
              </div>
            )}
            {canaryMatchStatus === 'mismatch' && (
              <div className="p-2 rounded bg-[#FEF2F2] border border-[#FCA5A5] text-[11px] text-[#B91C1C] flex items-center gap-1.5 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 text-[#B91C1C]" />
                <span>Hash Mismatch: This canary does NOT match the on-chain commitment. Manufactured or wrong tokens will be rejected.</span>
              </div>
            )}
            <p className="text-[11px] text-[#6B7280]">
              🛡️ <strong>Anti-Manufacture Rule:</strong> Whistleblowers can only claim bounties by submitting the real secret canary token embedded in the leaked document.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-md bg-[#FEF2F2] border border-[#FCA5A5] text-xs text-[#B91C1C] flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Anti-spam Deposit Info */}
          <div className="p-3 rounded-md bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#92400E] space-y-1">
            <div className="flex items-center justify-between font-bold">
              <span>Anti-Spam Security Bond (Required):</span>
              <span className="font-mono text-[#B45309]">{formatGen(minBondWei.toString())} GEN (5%)</span>
            </div>
            <p className="text-[11px] leading-relaxed text-[#78350F]">
              Staked by reporter to prevent spam DoS attacks. <strong>100% refunded</strong> upon breach confirmation. Slashed to issuer only if evidence is fraudulent, missing the canary, or an unverified rumor.
            </p>
          </div>

          <div className="p-3 rounded-md bg-[#F0FDF4] border border-[#86EFAC] text-xs text-[#166534] flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-[#15803D] flex-shrink-0 mt-0.5" />
            <span>
              <strong>Bounty Guarantee:</strong> Upon confirmed breach consensus, the smart contract
              autonomously transfers 100% of the bounty ({formatGen(caseData.bounty_amount)} GEN) + full bond refund to your wallet (
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
              disabled={isSubmitting || !account || canaryMatchStatus === 'mismatch'}
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
