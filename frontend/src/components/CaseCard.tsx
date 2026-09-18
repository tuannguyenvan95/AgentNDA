import React, { useState } from 'react';
import {
  Shield,
  ShieldAlert,
  AlertTriangle,
  Lock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Cpu,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { NDACaseData } from '../config/genlayer';
import { formatAddress, formatGen, getStatusMeta } from '../utils/helpers';

interface CaseCardProps {
  caseItem: NDACaseData;
  account: string | null;
  onReportLeak: (caseItem: NDACaseData) => void;
  onAdjudicateLeak: (caseItem: NDACaseData) => void;
  onCloseAndReclaim: (caseItem: NDACaseData) => void;
  onViewJuryReport: (caseItem: NDACaseData) => void;
  isActionPending?: boolean;
}

export const CaseCard: React.FC<CaseCardProps> = ({
  caseItem,
  account,
  onReportLeak,
  onAdjudicateLeak,
  onCloseAndReclaim,
  onViewJuryReport,
  isActionPending = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  const meta = getStatusMeta(caseItem.status, caseItem.verdict);

  const isIssuer =
    account && caseItem.issuer && account.toLowerCase() === caseItem.issuer.toLowerCase();

  return (
    <div className={`glass-panel rounded-2xl p-5 sm:p-6 border transition-all duration-300 relative overflow-hidden ${meta.borderClass} hover:border-indigo-500/40`}>
      {/* Top Bar: Case ID & Status Badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${meta.bgClass} border ${meta.borderClass} ${meta.textClass}`}>
            {caseItem.status === 2 ? (
              <ShieldAlert className="w-5 h-5" />
            ) : caseItem.status === 1 ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <Shield className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-extrabold text-white text-sm sm:text-base">
                {caseItem.case_id}
              </span>
              {isIssuer && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  YOU ARE ISSUER
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Issuer: {formatAddress(caseItem.issuer)}
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${meta.badgeClass}`}>
          {meta.label}
        </span>
      </div>

      {/* Bounty & Metrics Row */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-black/40 border border-white/5 text-xs">
        <div>
          <span className="text-[11px] text-slate-400 block">Bounty in Escrow</span>
          <span className="font-mono font-bold text-sm text-indigo-400">
            {formatGen(caseItem.bounty_amount)} GEN
          </span>
        </div>
        <div>
          <span className="text-[11px] text-slate-400 block">Whistleblower</span>
          <span className="font-mono font-semibold text-slate-200">
            {formatAddress(caseItem.whistleblower)}
          </span>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <span className="text-[11px] text-slate-400 block">Verdict Outcome</span>
          <span
            className={`font-mono font-bold ${
              caseItem.verdict === 'BREACH_CONFIRMED'
                ? 'text-rose-400'
                : caseItem.verdict === 'NO_BREACH'
                ? 'text-emerald-400'
                : 'text-slate-400'
            }`}
          >
            {caseItem.verdict}
          </span>
        </div>
      </div>

      {/* Protected Scope Snippet */}
      <div className="mt-4 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Protected Scope & Canary Definition:</span>
          </span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
          >
            <span>{expanded ? 'Collapse' : 'Expand'}</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
        <div
          className={`p-3 rounded-xl bg-black/30 border border-white/5 font-mono text-xs text-slate-300 whitespace-pre-wrap ${
            expanded ? '' : 'line-clamp-2'
          }`}
        >
          {caseItem.nda_scope}
        </div>
      </div>

      {/* Evidence URL if reported */}
      {caseItem.evidence_url && (
        <div className="mt-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs">
          <div className="text-[11px] font-semibold text-amber-400 flex items-center justify-between">
            <span>Reported Leak Evidence URL:</span>
            <a
              href={caseItem.evidence_url}
              target="_blank"
              rel="noreferrer"
              className="text-amber-300 hover:underline flex items-center gap-1 text-[10px]"
            >
              <span>Visit Link</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="mt-1 font-mono text-[11px] text-slate-300 truncate">
            {caseItem.evidence_url}
          </div>
        </div>
      )}

      {/* AI Jury Reason Preview if evaluated */}
      {caseItem.reason && caseItem.status !== 0 && (
        <div className="mt-3 p-3 rounded-xl bg-black/40 border border-white/5 text-xs text-slate-300 font-mono line-clamp-2">
          <span className="font-semibold text-slate-400 block text-[10px] uppercase">
            AI Jury Summary:
          </span>
          {caseItem.reason}
        </div>
      )}

      {/* Action Buttons Footer */}
      <div className="mt-5 pt-4 border-t border-white/5 flex flex-wrap items-center justify-between gap-3">
        {/* Left Side Info / Report Button */}
        <div>
          {caseItem.status === 0 && (
            <button
              onClick={() => onReportLeak(caseItem)}
              disabled={isActionPending}
              className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Report Leak (Whistleblower)</span>
            </button>
          )}

          {caseItem.status === 1 && (
            <button
              onClick={() => onAdjudicateLeak(caseItem)}
              disabled={isActionPending}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-600 hover:to-indigo-700 text-white text-xs font-bold shadow-lg shadow-cyan-500/25 flex items-center gap-2 transition disabled:opacity-50 animate-pulse"
            >
              <Cpu className="w-4 h-4" />
              <span>Trigger AI Jury Adjudication</span>
            </button>
          )}

          {(caseItem.status === 2 || caseItem.verdict === 'NO_BREACH') && (
            <button
              onClick={() => onViewJuryReport(caseItem)}
              className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Inspect AI Verdict</span>
            </button>
          )}
        </div>

        {/* Right Side Actions: Issuer Reclaim / Details */}
        <div className="flex items-center gap-2">
          {caseItem.status === 0 && isIssuer && (
            <button
              onClick={() => onCloseAndReclaim(caseItem)}
              disabled={isActionPending}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition flex items-center gap-1.5 disabled:opacity-50"
              title="Reclaim escrowed funds if contract term has expired without breach"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Reclaim Escrow</span>
            </button>
          )}

          {caseItem.reason && (
            <button
              onClick={() => onViewJuryReport(caseItem)}
              className="text-xs text-slate-400 hover:text-slate-200 transition font-medium"
            >
              Details
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
