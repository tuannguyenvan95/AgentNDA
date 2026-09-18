import React from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Cpu,
  ExternalLink,
  CheckCircle2,
  XCircle,
  X,
  FileText,
  Lock,
} from 'lucide-react';
import { NDACaseData } from '../config/genlayer';
import { formatAddress, formatGen, getExplorerUrl } from '../utils/helpers';

interface BreachJuryModalProps {
  caseData: NDACaseData | null;
  onClose: () => void;
}

export const BreachJuryModal: React.FC<BreachJuryModalProps> = ({ caseData, onClose }) => {
  if (!caseData) return null;

  const isConfirmed = caseData.verdict === 'BREACH_CONFIRMED';
  const isNoBreach = caseData.verdict === 'NO_BREACH';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="w-full max-w-3xl bg-[#121722] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative my-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-6 top-6 text-slate-400 hover:text-white transition p-1"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-start gap-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
              isConfirmed
                ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                : isNoBreach
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                : 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400'
            }`}
          >
            {isConfirmed ? (
              <ShieldAlert className="w-6 h-6" />
            ) : isNoBreach ? (
              <ShieldCheck className="w-6 h-6" />
            ) : (
              <Cpu className="w-6 h-6" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400">Case ID: {caseData.case_id}</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wide border ${
                  isConfirmed
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    : isNoBreach
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                }`}
              >
                {caseData.verdict}
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white mt-1">
              On-Chain AI Jury Adjudication Report
            </h3>
            <p className="text-xs text-slate-400">
              Evaluated autonomously by GenLayer decentralized LLM validator consensus.
            </p>
          </div>
        </div>

        {/* Core Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Metric 1: Verdict */}
          <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Consensus Verdict
            </span>
            <div className="flex items-center gap-1.5 text-base font-bold">
              {isConfirmed ? (
                <>
                  <XCircle className="w-4 h-4 text-rose-400" />
                  <span className="text-rose-400">BREACH CONFIRMED</span>
                </>
              ) : isNoBreach ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">NO BREACH DETECTED</span>
                </>
              ) : (
                <span className="text-slate-300">{caseData.verdict}</span>
              )}
            </div>
          </div>

          {/* Metric 2: Severity Score */}
          <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Leak Severity Score
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-xl font-extrabold font-mono ${caseData.leak_severity >= 70 ? 'text-rose-400' : 'text-slate-300'}`}>
                {caseData.leak_severity}
              </span>
              <span className="text-xs text-slate-500">/ 100</span>
            </div>
            {/* Visual Bar */}
            <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  caseData.leak_severity >= 70 ? 'bg-rose-500' : 'bg-indigo-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, caseData.leak_severity))}%` }}
              />
            </div>
          </div>

          {/* Metric 3: Consensus Confidence */}
          <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Validator Confidence
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-extrabold text-cyan-400 font-mono">
                {caseData.confidence}
              </span>
              <span className="text-xs text-slate-500">%</span>
            </div>
            {/* Visual Bar */}
            <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-cyan-400 transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, caseData.confidence))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Detailed Jury Rationale */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-indigo-400" />
            <span>Official Consensus Court Rationale:</span>
          </label>
          <div className="p-4 rounded-2xl bg-black/50 border border-white/10 text-xs text-slate-200 leading-relaxed font-mono whitespace-pre-wrap">
            {caseData.reason || 'Consensus evaluation in progress.'}
          </div>
        </div>

        {/* Evidence & Scope Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Left: Protected Scope */}
          <div className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-2">
            <span className="font-semibold text-slate-400 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Protected NDA Criteria & Canaries:</span>
            </span>
            <div className="p-3 bg-black/40 rounded-xl font-mono text-[11px] text-slate-300 max-h-36 overflow-y-auto whitespace-pre-wrap">
              {caseData.nda_scope}
            </div>
          </div>

          {/* Right: Submitted Evidence */}
          <div className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-2">
            <span className="font-semibold text-slate-400 flex items-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
              <span>Extracted Web Evidence URL:</span>
            </span>
            {caseData.evidence_url ? (
              <a
                href={caseData.evidence_url}
                target="_blank"
                rel="noreferrer"
                className="p-3 bg-black/40 rounded-xl font-mono text-[11px] text-cyan-400 hover:underline block break-all"
              >
                {caseData.evidence_url}
              </a>
            ) : (
              <div className="p-3 bg-black/40 rounded-xl text-slate-500 font-mono text-[11px]">
                No evidence URL submitted yet.
              </div>
            )}
            <div className="pt-2 text-[10px] text-slate-400 space-y-1">
              <div>Whistleblower: <span className="font-mono text-slate-200">{formatAddress(caseData.whistleblower)}</span></div>
              <div>Bounty Settled: <span className="font-mono text-indigo-400">{formatGen(caseData.bounty_amount)} GEN</span></div>
            </div>
          </div>
        </div>

        {/* GenLayer Architectural Note */}
        <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-200 space-y-1.5">
          <div className="font-bold flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span>Why GenLayer Makes This Possible (Solidity Cannot Do This)</span>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-300">
            Standard EVM smart contracts cannot browse the public internet or understand semantic leaks.
            AgentNDA runs on <strong>GenLayer GenVM</strong>: validators directly executed <code>gl.nondet.web.render</code> on
            the submitted URL and reached Byzantine consensus on the verdict via <code>gl.vm.run_nondet</code> without trusting any centralized oracle.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="pt-2 flex items-center justify-between">
          <a
            href={getExplorerUrl(caseData.case_id, 'tx')}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-slate-400 hover:text-cyan-400 flex items-center gap-1.5 transition"
          >
            <span>Inspect On GenLayer Explorer</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
};
