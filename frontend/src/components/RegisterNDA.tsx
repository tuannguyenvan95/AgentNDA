import React, { useState } from 'react';
import { Lock, Sparkles, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { parseGen } from '../utils/helpers';
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
    name: 'Unreleased Token TGE & Valuation',
    bounty: '5.0',
    scope: `CONFIDENTIAL PROJECT EMBARGO:
1. Token Launch (TGE) target date: October 28, 2026.
2. Initial FDV target: $120,000,000.
3. Private seed tier discount: 45%.
4. CANARY PHRASE: CANARY_PHRASE_PROJECT_OMEGA_SEC_KEY_998.
Any public posting, blog, or tweet disclosing these exact terms or the canary identifier constitutes a material breach.`,
  },
  {
    name: 'Proprietary Zero-Knowledge Circuit',
    bounty: '10.0',
    scope: `PROPRIETARY ZK-ROLLUP CIRCUIT SPECS:
1. Unannounced recursive SNARK folding scheme based on Plonky3 modifications.
2. Internal benchmark proving time: 420ms per batch.
3. CANARY PHRASE: ZK_CIRCUIT_INTERNAL_ALPHA_CANARY_771.
Public release of benchmark logs or source snippets prior to mainnet launch is strictly prohibited.`,
  },
  {
    name: 'M&A Acquisition Terms',
    bounty: '20.0',
    scope: `CONFIDENTIAL M&A DISCLOSURE:
1. Pending acquisition of Autonomous Agent Labs by Protocol Core.
2. Agreed all-cash purchase consideration: $15.5M.
3. CANARY PHRASE: MNA_ACQUISITION_CANARY_TOKEN_VAL_443.
Early leak of negotiation memorandums or deal structure warrants full bounty forfeiture.`,
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
  const [ndaScope, setNdaScope] = useState(PRESET_TEMPLATES[0].scope);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSelectPreset = (preset: typeof PRESET_TEMPLATES[0]) => {
    setBountyAmount(preset.bounty);
    setNdaScope(preset.scope);
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

    if (!ndaScope.trim()) {
      setErrorMsg('Confidential NDA scope definition cannot be empty.');
      return;
    }

    const durationSeconds = Math.max(86400, parseInt(durationDays, 10) * 86400);

    setErrorMsg(null);
    setIsSubmitting(true);
    onTxStart(
      'Registering Escrow Docket',
      `Locking ${bountyAmount} GEN into on-chain escrow bond for ${durationDays} days and indexing canary parameters.`
    );

    try {
      await registerNdaEscrowOnChain(contractAddress, account, ndaScope, wei, durationSeconds);
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
              <span className="text-xs font-mono text-[#6B7280]">ESCROW REGISTRY</span>
            </div>
            <h2 className="font-serif font-bold text-2xl sm:text-3xl text-[#111827] tracking-tight">
              Register Confidential Scope & Escrow Bond
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-[#4B5563] leading-relaxed">
              Deposit native GEN into the autonomous GenLayer court. Specify confidential clauses
              and canary tokens. Whistleblowers who prove unauthorized disclosure on the public web
              will be awarded this bounty upon decentralized AI consensus.
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
                  {preset.bounty} GEN Bond
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

          {/* Scope Definition */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#111827] uppercase tracking-wider flex items-center justify-between">
              <span>Protected NDA Criteria & Canary Identifiers</span>
              <span className="text-[11px] font-sans font-normal text-[#6B7280]">
                Scrutinized by GenLayer AI Validators
              </span>
            </label>
            <textarea
              rows={6}
              value={ndaScope}
              onChange={(e) => setNdaScope(e.target.value)}
              placeholder="State the secret facts, parameters, and insert canary identifiers..."
              required
              className="w-full px-3.5 py-2.5 bg-[#F9F8F6] border border-[#E5E5E0] rounded-md text-xs font-mono text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#111827] focus:bg-[#FFFFFF] transition resize-y leading-relaxed"
            />
            <p className="text-[11px] text-[#6B7280]">
              💡 <strong>Gazette Advice:</strong> Provide exact canary tokens (e.g. <code>CANARY_PHRASE_PROJECT_OMEGA_SEC_KEY_998</code>).
              Validators execute semantic comparison to verify whether the canary or specific secrets appear in reported web links.
            </p>
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
