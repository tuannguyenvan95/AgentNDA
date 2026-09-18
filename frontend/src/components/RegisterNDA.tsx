import React, { useState } from 'react';
import { Lock, Sparkles, Shield, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
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
      setErrorMsg('Confidential NDA scope cannot be empty.');
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);
    onTxStart(
      'Locking Bounty & Registering NDA',
      `Locking ${bountyAmount} GEN into on-chain escrow and registering confidential canary markers.`
    );

    try {
      await registerNdaEscrowOnChain(contractAddress, account, ndaScope, wei);
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
      <div className="glass-panel rounded-3xl p-6 sm:p-8 relative overflow-hidden border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/5 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold text-indigo-400 mb-3">
              <Shield className="w-3.5 h-3.5" />
              <span>Issuer Escrow Console</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Create On-Chain NDA & Escrow Bond
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-400 leading-relaxed">
              Lock native GEN into an autonomous smart contract. Define the protected trade secrets
              and canary identifiers. If a leak is discovered and proven on-chain, the whistleblower
              autonomously receives the bounty.
            </p>
          </div>
          <div className="hidden sm:flex w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 items-center justify-center text-indigo-400 flex-shrink-0">
            <Lock className="w-6 h-6" />
          </div>
        </div>

        {/* Quick Presets */}
        <div className="pt-6 space-y-3">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Load Quick Demo Template:</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {PRESET_TEMPLATES.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className="text-left p-3 rounded-xl bg-white/5 border border-white/5 hover:border-indigo-500/40 hover:bg-white/10 transition group"
              >
                <div className="text-xs font-bold text-white group-hover:text-indigo-300 transition">
                  {preset.name}
                </div>
                <div className="text-[11px] text-slate-400 mt-1 font-mono">
                  {preset.bounty} GEN Escrow
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* Bounty Amount */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Bounty Amount to Lock in Escrow (GEN)</span>
              <span className="text-[11px] text-indigo-400">Transferred from your wallet</span>
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
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono">
                GEN
              </span>
            </div>
          </div>

          {/* NDA Scope & Canary Markers */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Protected NDA Scope & Canary Identifiers</span>
              <span className="text-[11px] text-slate-500">Evaluated by GenLayer AI Consensus</span>
            </label>
            <textarea
              rows={6}
              value={ndaScope}
              onChange={(e) => setNdaScope(e.target.value)}
              placeholder="Specify the confidential criteria, forbidden disclosures, and unique canary keywords..."
              required
              className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition resize-y"
            />
            <p className="text-[11px] text-slate-400">
              💡 <strong>Tip:</strong> Include a unique Canary Token (e.g. <code>CANARY_PHRASE_PROJECT_OMEGA_SEC_KEY_998</code>).
              When a leak URL is submitted, the AI Jury checks if this specific string was exposed.
            </p>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !account}
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white text-sm font-bold shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Locking Escrow & Registering On-Chain...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Lock {bountyAmount} GEN & Register NDA</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
            {!account && (
              <p className="text-center text-xs text-slate-500 mt-2">
                Connect your MetaMask wallet on Studionet to lock bounty.
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
