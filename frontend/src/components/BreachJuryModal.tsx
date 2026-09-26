import React from 'react';
import {
  ExternalLink,
  CheckCircle2,
  XCircle,
  X,
  FileText,
  Lock,
  Scale,
  ShieldCheck,
  UserCheck,
  Key,
} from 'lucide-react';
import { NDACaseData } from '../config/genlayer';
import { formatAddress, formatGen } from '../utils/helpers';

interface BreachJuryModalProps {
  caseData: NDACaseData | null;
  onClose: () => void;
}

export const BreachJuryModal: React.FC<BreachJuryModalProps> = ({ caseData, onClose }) => {
  if (!caseData) return null;

  const isConfirmed = caseData.verdict === 'BREACH_CONFIRMED';
  const isNoBreach = caseData.verdict === 'NO_BREACH';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-3xl bg-[#FFFFFF] border border-[#E5E5E0] rounded-xl p-6 sm:p-8 shadow-2xl space-y-5 relative my-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 text-[#6B7280] hover:text-[#111827] transition p-1 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Gazette Judicial Header */}
        <div className="border-b border-[#E5E5E0] pb-4 flex items-start gap-3.5">
          <div
            className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isConfirmed
                ? 'bg-[#FEF2F2] border border-[#FCA5A5] text-[#B91C1C]'
                : isNoBreach
                ? 'bg-[#F0FDF4] border border-[#86EFAC] text-[#15803D]'
                : 'bg-[#F3F4F6] border border-[#E5E5E0] text-[#111827]'
            }`}
          >
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-[#6B7280]">DOCKET #{caseData.case_id}</span>
              <span
                className={
                  isConfirmed
                    ? 'press-tag press-tag-crimson'
                    : isNoBreach
                    ? 'press-tag press-tag-forest'
                    : 'press-tag press-tag-neutral'
                }
              >
                {caseData.verdict}
              </span>
            </div>
            <h3 className="font-serif font-bold text-2xl text-[#111827] tracking-tight">
              On-Chain AI Jury Adjudication Gazette
            </h3>
            <p className="text-xs text-[#4B5563]">
              Official consensus judgment rendered by decentralized GenLayer LLM validator court with verifiable provenance.
            </p>
          </div>
        </div>

        {/* 3 Core Metric Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Verdict Box */}
          <div className="p-3.5 rounded-lg bg-[#F9F8F6] border border-[#E5E5E0] space-y-1">
            <span className="text-[10px] uppercase font-bold text-[#6B7280] tracking-wider block">
              Consensus Ruling
            </span>
            <div className="flex items-center gap-1.5 font-serif font-bold text-base">
              {isConfirmed ? (
                <>
                  <XCircle className="w-4 h-4 text-[#B91C1C]" />
                  <span className="text-[#B91C1C]">BREACH CONFIRMED</span>
                </>
              ) : isNoBreach ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#15803D]" />
                  <span className="text-[#15803D]">NO BREACH DETECTED</span>
                </>
              ) : (
                <span className="text-[#111827]">{caseData.verdict}</span>
              )}
            </div>
          </div>

          {/* Severity Score */}
          <div className="p-3.5 rounded-lg bg-[#F9F8F6] border border-[#E5E5E0] space-y-1">
            <span className="text-[10px] uppercase font-bold text-[#6B7280] tracking-wider block">
              Exposure Severity
            </span>
            <div className="flex items-baseline gap-1">
              <span
                className={`font-serif font-bold text-2xl ${
                  caseData.leak_severity >= 70
                    ? 'text-[#B91C1C]'
                    : caseData.leak_severity >= 40
                    ? 'text-[#B45309]'
                    : 'text-[#15803D]'
                }`}
              >
                {caseData.leak_severity}
              </span>
              <span className="text-xs text-[#6B7280]">/ 100</span>
            </div>
            <div className="w-full bg-[#E5E5E0] rounded-full h-1.5 mt-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  caseData.leak_severity >= 70
                    ? 'bg-[#B91C1C]'
                    : caseData.leak_severity >= 40
                    ? 'bg-[#F59E0B]'
                    : 'bg-[#15803D]'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, caseData.leak_severity))}%` }}
              />
            </div>
          </div>

          {/* Confidence Metric */}
          <div className="p-3.5 rounded-lg bg-[#F9F8F6] border border-[#E5E5E0] space-y-1">
            <span className="text-[10px] uppercase font-bold text-[#6B7280] tracking-wider block">
              Validator Confidence
            </span>
            <div className="flex items-baseline gap-1">
              <span className="font-serif font-bold text-2xl text-[#111827]">
                {caseData.confidence}
              </span>
              <span className="text-xs text-[#6B7280]">%</span>
            </div>
            <div className="w-full bg-[#E5E5E0] rounded-full h-1.5 mt-1.5 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#111827] transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, caseData.confidence))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Bound Party Attribution & Cryptographic Commitment Verification */}
        <div className="p-3.5 rounded-lg bg-[#F9F8F6] border border-[#E5E5E0] text-xs space-y-2">
          <div className="font-bold text-[#111827] flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#15803D]" />
            <span>Cryptographic Proof-of-Discovery & Party Attribution:</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="p-2 bg-[#FFFFFF] rounded border border-[#E5E5E0] space-y-0.5">
              <span className="text-[#6B7280] text-[10px] uppercase block">Bound NDA Counterparty:</span>
              <span className="font-semibold text-[#111827] flex items-center gap-1">
                <UserCheck className="w-3 h-3 text-[#2563EB]" />
                {caseData.party_identifier || formatAddress(caseData.nda_party)}
              </span>
            </div>

            <div className="p-2 bg-[#FFFFFF] rounded border border-[#E5E5E0] space-y-0.5">
              <span className="text-[#6B7280] text-[10px] uppercase block">Canary Commitment (SHA-256):</span>
              <span className="text-[#4B5563] text-[10px] truncate block" title={caseData.canary_commitment}>
                {caseData.canary_commitment ? `${caseData.canary_commitment.slice(0, 14)}...${caseData.canary_commitment.slice(-8)}` : 'On-chain commitment verified'}
              </span>
            </div>
          </div>

          {caseData.discovered_canary && (
            <div className="p-2 bg-[#F0FDF4] rounded border border-[#86EFAC] text-[11px] font-mono text-[#166534] flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Key className="w-3 h-3 text-[#15803D]" />
                <span>Verified Discovered Canary:</span>
              </span>
              <span className="font-bold">{caseData.discovered_canary}</span>
            </div>
          )}
        </div>

        {/* Detailed Jury Rationale */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#111827] uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-[#111827]" />
            <span>Official Consensus Proceeding Rationale:</span>
          </label>
          <div className="p-4 rounded-lg bg-[#F9F8F6] border border-[#E5E5E0] text-xs text-[#374151] leading-relaxed font-mono whitespace-pre-wrap">
            {caseData.reason || 'Consensus evaluation in progress.'}
          </div>
        </div>

        {/* Protected Subject Matter & Evidence Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {/* Left: Protected Subject Matter */}
          <div className="p-3.5 rounded-lg bg-[#FFFFFF] border border-[#E5E5E0] space-y-1.5">
            <span className="font-bold text-[#111827] flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-[#6B7280]" />
              <span>Protected Subject Matter:</span>
            </span>
            <div className="p-2.5 bg-[#F9F8F6] rounded border border-[#E5E5E0] font-mono text-[11px] text-[#374151] max-h-32 overflow-y-auto whitespace-pre-wrap">
              {caseData.public_nda_topic || caseData.nda_scope}
            </div>
          </div>

          {/* Right: Submitted Evidence */}
          <div className="p-3.5 rounded-lg bg-[#FFFFFF] border border-[#E5E5E0] space-y-1.5">
            <span className="font-bold text-[#111827] flex items-center gap-1">
              <ExternalLink className="w-3.5 h-3.5 text-[#6B7280]" />
              <span>Crawled Public Evidence:</span>
            </span>
            {caseData.evidence_url ? (
              <a
                href={caseData.evidence_url}
                target="_blank"
                rel="noreferrer"
                className="p-2.5 bg-[#F9F8F6] rounded border border-[#E5E5E0] font-mono text-[11px] text-[#B91C1C] hover:underline block break-all"
              >
                {caseData.evidence_url}
              </a>
            ) : (
              <div className="p-2.5 bg-[#F9F8F6] rounded border border-[#E5E5E0] text-[#9CA3AF] font-mono text-[11px]">
                No evidence URL on record.
              </div>
            )}
          </div>
        </div>

        {/* Payout Summary if Confirmed */}
        {isConfirmed && (
          <div className="p-3.5 rounded-lg bg-[#F0FDF4] border border-[#86EFAC] text-xs text-[#166534] flex items-center justify-between">
            <div>
              <span className="font-bold block text-sm">Autonomous Whistleblower Payout Settled</span>
              <span className="text-[11px] text-[#15803D]">
                Transferred to: {formatAddress(caseData.whistleblower)}
              </span>
            </div>
            <span className="font-serif font-bold text-lg text-[#15803D]">
              +{formatGen(caseData.bounty_amount)} GEN
            </span>
          </div>
        )}

        {/* Footer CTA */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-md bg-[#111827] hover:bg-[#1F2937] text-white text-xs font-bold uppercase tracking-wider transition cursor-pointer"
          >
            Dismiss Ledger
          </button>
        </div>
      </div>
    </div>
  );
};
