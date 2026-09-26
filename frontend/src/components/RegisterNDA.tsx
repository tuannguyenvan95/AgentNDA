import React, { useState, useEffect } from 'react';
import { Lock, Sparkles, ArrowRight, Loader2, AlertCircle, Key, Copy, Check, ShieldCheck, RefreshCw } from 'lucide-react';
import { parseGen, computeSha256 } from '../utils/helpers';
import { registerNdaEscrowOnChain } from '../config/genlayer';

interface RegisterNDAProps {
  contractAddress: string;
  account: string | null;
  onSuccess: () => void;
  onTxStart: (title: string, desc: string) => void;
  onTxEnd: () => void;
}

const PRESET_TEMPLATES = [
  {
    name: 'Unreleased Token TGE & Private Valuation',
    bounty: '5.0',
    topic: 'Confidential Token Launch Embargo (October 28, 2026 Target, $120M FDV, Seed Discount terms).',
    party: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    identifier: '@seed_advisor_firm',
    canary: 'CANARY_TGE_OMEGA_FDV_120M_KEY_77492',
  },
  {
    name: 'Proprietary Zero-Knowledge Circuit Specs',
    bounty: '10.0',
    topic: 'Confidential recursive SNARK folding scheme benchmarking logs and modified Plonky3 logic.',
    party: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    identifier: 'github.com/zk-audit-partner',
    canary: 'CANARY_ZK_CIRCUIT_INTERNAL_ALPHA_SEC_9921',
  },
  {
    name: 'M&A Acquisition Terms & Consideration',
    bounty: '20.0',
    topic: 'M&A Acquisition Memorandums, $15.5M cash consideration and agent lab IP transfer.',
    party: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    identifier: 'autonomousagentlabs.eth',
    canary: 'CANARY_MNA_ACQUISITION_DEAL_MEMO_88412',
  },
];

export const RegisterNDA: React.FC<RegisterNDAProps> = ({
  contractAddress,
  account,
  onSuccess,
  onTxStart,
  onTxEnd,
}) => {
  const [bountyAmount, setBountyAmount] = useState('5.0');
  const [durationDays, setDurationDays] = useState('7');
  const [publicTopic, setPublicTopic] = useState(PRESET_TEMPLATES[0].topic);
  const [ndaParty, setNdaParty] = useState(PRESET_TEMPLATES[0].party);
  const [partyIdentifier, setPartyIdentifier] = useState(PRESET_TEMPLATES[0].identifier);
  const [secretCanary, setSecretCanary] = useState(PRESET_TEMPLATES[0].canary);
  const [canaryHash, setCanaryHash] = useState('');
  const [copiedCanary, setCopiedCanary] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Compute SHA-256 commitment hash whenever secretCanary changes
  useEffect(() => {
    if (secretCanary.trim()) {
      computeSha256(secretCanary.trim()).then(setCanaryHash);
    } else {
      setCanaryHash('');
    }
  }, [secretCanary]);

  const handleGenerateCanary = () => {
    const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
    setSecretCanary(`CANARY_SEC_${randomHex}`);
  };

  const handleCopyCanary = () => {
    navigator.clipboard.writeText(secretCanary);
    setCopiedCanary(true);
    setTimeout(() => setCopiedCanary(false), 2000);
  };

  const handleSelectPreset = (preset: typeof PRESET_TEMPLATES[0]) => {
    setBountyAmount(preset.bounty);
    setPublicTopic(preset.topic);
    setNdaParty(preset.party);
    setPartyIdentifier(preset.identifier);
    setSecretCanary(preset.canary);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) {
      setErrorMsg('Please connect your MetaMask wallet first.');
      return;
    }

    const wei = parseGen(bountyAmount);
    if (wei <= 0n) {
      setErrorMsg('Escrow bounty must be greater than 0 GEN.');
      return;
    }

    if (!publicTopic.trim()) {
      setErrorMsg('Public NDA topic description cannot be empty.');
      return;
    }

    if (!ndaParty.trim() || !ndaParty.trim().startsWith('0x') || ndaParty.trim().length !== 42) {
      setErrorMsg('Valid bound counterparty address (0x...) is required.');
      return;
    }

    if (!partyIdentifier.trim()) {
      setErrorMsg('Counterparty identifier (e.g. GitHub handle, domain, or handle) is required.');
      return;
    }

    if (!secretCanary.trim() || secretCanary.trim().length < 6) {
      setErrorMsg('Secret canary token must be at least 6 characters.');
      return;
    }

    const commitment = await computeSha256(secretCanary.trim());
    const durationSeconds = Math.max(86400, parseInt(durationDays, 10) * 86400);

    setErrorMsg(null);
    setIsSubmitting(true);
    onTxStart(
      'Registering Protected Escrow Docket',
      `Locking ${bountyAmount} GEN into escrow with non-public canary commitment for bound party ${partyIdentifier}.`
    );

    try {
      await registerNdaEscrowOnChain(
        contractAddress,
        account,
        publicTopic,
        ndaParty,
        partyIdentifier,
        commitment,
        wei,
        durationSeconds
      );
      onSuccess();
    } catch (err: any) {
      console.error('Error registering NDA escrow:', err);
      setErrorMsg(err.message || 'Transaction failed. Check console for details.');
    } finally {
      setIsSubmitting(false);
      onTxEnd();
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-[#FFFFFF] border border-[#E5E5E0] rounded-xl p-6 sm:p-8 shadow-xs">
        {/* Editorial Section Header */}
        <div className="border-b border-[#E5E5E0] pb-5 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="press-tag press-tag-neutral text-[10px]">
                ISSUER ENTRY DISPATCH
              </span>
              <span className="text-xs font-mono text-[#6B7280]">NON-PUBLIC COMMITMENT ESCROW</span>
            </div>
            <h2 className="font-serif font-bold text-2xl sm:text-3xl text-[#111827] tracking-tight">
              Register Autonomous NDA Escrow Docket
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-[#4B5563] leading-relaxed">
              Deposit native GEN into the autonomous GenLayer court. Only a cryptographic hash commitment
              of your canary secret is anchored on-chain. Counterparty attribution and verifiable provenance
              guarantee that reporters cannot manufacture fake leaks.
            </p>
          </div>
          <div className="hidden sm:flex w-10 h-10 rounded-lg bg-[#F9F8F6] border border-[#E5E5E0] items-center justify-center text-[#111827]">
            <Lock className="w-5 h-5" />
          </div>
        </div>

        {/* Quick Presets */}
        <div className="pt-5 space-y-2.5">
          <label className="text-xs font-bold text-[#111827] uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#B91C1C]" />
            <span>Official Demonstration Templates:</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {PRESET_TEMPLATES.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className="text-left p-3 rounded-lg bg-[#F9F8F6] border border-[#E5E5E0] hover:border-[#111827] hover:bg-[#F3F4F6] transition cursor-pointer"
              >
                <div className="font-serif font-bold text-xs text-[#111827]">
                  {preset.name}
                </div>
                <div className="text-[11px] text-[#6B7280] mt-1 font-mono">
                  {preset.bounty} GEN · {preset.identifier}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* Bounty Amount & Duration Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Bounty Amount */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#111827] uppercase tracking-wider flex items-center justify-between">
                <span>Bounty Bond (GEN)</span>
                <span className="text-[11px] font-sans font-normal text-[#6B7280]">
                  Escrowed balance
                </span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={bountyAmount}
                  onChange={(e) => setBountyAmount(e.target.value)}
                  placeholder="5.0"
                  required
                  className="w-full px-3.5 py-2.5 bg-[#F9F8F6] border border-[#E5E5E0] rounded-md text-sm font-mono text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#111827] focus:bg-[#FFFFFF] transition"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#4B5563] font-mono">
                  GEN
                </span>
              </div>
            </div>

            {/* Confidential Duration */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#111827] uppercase tracking-wider flex items-center justify-between">
                <span>Protected Duration</span>
                <span className="text-[11px] font-sans font-normal text-[#6B7280]">
                  Time-lock period
                </span>
              </label>
              <select
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F9F8F6] border border-[#E5E5E0] rounded-md text-sm font-sans text-[#111827] focus:outline-none focus:border-[#111827] focus:bg-[#FFFFFF] transition cursor-pointer"
              >
                <option value="1">1 Day (Fast Demo / 24h Embargo)</option>
                <option value="7">7 Days (Standard Launch Sprint)</option>
                <option value="30">30 Days (Extended Protection)</option>
                <option value="90">90 Days (Strategic NDA)</option>
              </select>
            </div>
          </div>

          {/* Bound NDA Counterparty Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#111827] uppercase tracking-wider">
                <span>Bound Counterparty Address</span>
              </label>
              <input
                type="text"
                value={ndaParty}
                onChange={(e) => setNdaParty(e.target.value)}
                placeholder="0x..."
                required
                className="w-full px-3.5 py-2.5 bg-[#F9F8F6] border border-[#E5E5E0] rounded-md text-xs font-mono text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#111827] focus:bg-[#FFFFFF] transition"
              />
              <p className="text-[10px] text-[#6B7280]">The partner/contractor wallet bound to this agreement.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#111827] uppercase tracking-wider">
                <span>Party Provenance Identifier</span>
              </label>
              <input
                type="text"
                value={partyIdentifier}
                onChange={(e) => setPartyIdentifier(e.target.value)}
                placeholder="e.g. github.com/partner-org, @dev_handle"
                required
                className="w-full px-3.5 py-2.5 bg-[#F9F8F6] border border-[#E5E5E0] rounded-md text-xs font-mono text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#111827] focus:bg-[#FFFFFF] transition"
              />
              <p className="text-[10px] text-[#6B7280]">Used by AI Jury to authenticate leak provenance.</p>
            </div>
          </div>

          {/* Public Topic Summary */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#111827] uppercase tracking-wider flex items-center justify-between">
              <span>Public NDA Subject Matter (No Confidential Secrets)</span>
              <span className="text-[11px] font-sans font-normal text-[#6B7280]">
                Visible On-Chain
              </span>
            </label>
            <input
              type="text"
              value={publicTopic}
              onChange={(e) => setPublicTopic(e.target.value)}
              placeholder="e.g. Q3 Strategic AI Architecture & Weight Checksums"
              required
              className="w-full px-3.5 py-2.5 bg-[#F9F8F6] border border-[#E5E5E0] rounded-md text-xs font-mono text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#111827] focus:bg-[#FFFFFF] transition"
            />
          </div>

          {/* Secret Canary Token & Non-Public Commitment */}
          <div className="space-y-2 p-4 rounded-lg bg-[#F9F8F6] border border-[#E5E5E0]">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#111827] uppercase tracking-wider flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-[#B45309]" />
                <span>Secret Canary Token (Kept Strictly Confidential)</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleGenerateCanary}
                  className="text-[11px] font-medium text-[#4B5563] hover:text-[#111827] flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Generate New</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyCanary}
                  className="text-[11px] font-medium text-[#15803D] hover:text-[#166534] flex items-center gap-1 cursor-pointer"
                >
                  {copiedCanary ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCanary ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <input
              type="text"
              value={secretCanary}
              onChange={(e) => setSecretCanary(e.target.value)}
              placeholder="CANARY_SECRET_..."
              required
              className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E5E5E0] rounded-md text-xs font-mono text-[#111827] focus:outline-none focus:border-[#111827] transition"
            />

            {/* Cryptographic Hash Commitment Display */}
            {canaryHash && (
              <div className="pt-2 text-[11px] font-mono text-[#4B5563] space-y-1">
                <div className="flex items-center gap-1 text-[#15803D] font-bold text-[10px] uppercase tracking-wider">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>On-Chain SHA-256 Non-Public Commitment (Anchored on GenLayer):</span>
                </div>
                <div className="p-2 bg-[#FFFFFF] rounded border border-[#E5E5E0] text-[10px] break-all text-[#374151]">
                  {canaryHash}
                </div>
                <p className="text-[10px] text-[#6B7280]">
                  🔒 <strong>Reviewer Guarantee:</strong> The plain text canary is NEVER stored on-chain.
                  Embed this secret canary phrase into the confidential deliverables handed to the counterparty.
                  Reporters cannot manufacture a leak because they cannot reverse the hash.
                </p>
              </div>
            )}
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3 rounded-md bg-[#FEF2F2] border border-[#FCA5A5] text-xs text-[#B91C1C] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Submit CTA */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !account}
              className="w-full py-3 px-6 rounded-md bg-[#111827] hover:bg-[#1F2937] text-white text-xs font-bold uppercase tracking-wider shadow-sm flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Committing Escrow Bond to Studionet...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-[#86EFAC]" />
                  <span>Lock {bountyAmount} GEN & Issue Escrow Docket</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
            {!account && (
              <p className="text-center text-xs text-[#6B7280] mt-2">
                Connect MetaMask wallet on Studionet to lock funds.
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
