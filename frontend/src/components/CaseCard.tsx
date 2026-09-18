import React, { useState } from 'react';
import {
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Cpu,
  RotateCcw,
  FileText,
  AlertTriangle,
  Scale,
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
    <div className="editorial-card rounded-xl p-5 sm:p-6 flex flex-col justify-between transition hover:shadow-press-md">
      <div>
        {/* Top Header: Docket ID & Status Tag */}
        <div className="flex items-start justify-between gap-3 border-b border-[#E5E5E0] pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-[#6B7280] font-semibold uppercase tracking-wider">
                DOCKET #{caseItem.case_id}
              </span>
              {isIssuer && (
                <span className="press-tag press-tag-neutral text-[9px]">
                  YOUR DOCKET
                </span>
              )}
            </div>
            <h3 className="font-serif font-bold text-xl text-[#111827] mt-0.5 leading-snug">
              Protected Escrow Agreement
            </h3>
            <p className="text-[11px] text-[#6B7280] font-mono mt-0.5">
              Issuer: {formatAddress(caseItem.issuer)}
            </p>
          </div>

          <div className="flex-shrink-0">
            <span className={meta.badgeClass}>
              {meta.label}
            </span>
          </div>
        </div>

        {/* Financial & Verdict Summary Ledger */}
        <div className="mt-4 p-3 bg-[#F9F8F6] border border-[#E5E5E0] rounded-lg text-xs space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <span className="text-[10px] uppercase font-semibold text-[#6B7280] block tracking-wider">
                Bounty Bond
              </span>
              <span className="font-serif font-bold text-base text-[#111827]">
                {formatGen(caseItem.bounty_amount)}
                <span className="text-[10px] font-mono ml-1 text-[#4B5563]">GEN</span>
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-semibold text-[#6B7280] block tracking-wider">
                Whistleblower
              </span>
              <span className="font-mono font-medium text-[#374151] text-xs truncate block mt-0.5">
                {formatAddress(caseItem.whistleblower)}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-semibold text-[#6B7280] block tracking-wider">
                Verdict Status
              </span>
              <span
                className={`font-mono font-bold text-xs block mt-0.5 ${
                  caseItem.verdict === 'BREACH_CONFIRMED'
                    ? 'text-[#B91C1C]'
                    : caseItem.verdict === 'NO_BREACH'
                    ? 'text-[#15803D]'
                    : 'text-[#6B7280]'
                }`}
              >
                {caseItem.verdict}
              </span>
            </div>
          </div>

          {/* Time-Lock & Bond Details */}
          {(caseItem.expires_at_timestamp || (caseItem.reporter_bond && BigInt(caseItem.reporter_bond) > 0n)) && (
            <div className="pt-2 border-t border-[#E5E5E0] text-[10px] text-[#6B7280] font-mono flex flex-wrap items-center justify-between gap-1">
              {caseItem.expires_at_timestamp && Number(caseItem.expires_at_timestamp) > 0 && (
                <span>
                  Expires:{' '}
                  <strong className="text-[#111827]">
                    {new Date(Number(caseItem.expires_at_timestamp) * 1000).toLocaleDateString()}{' '}
                    {new Date(Number(caseItem.expires_at_timestamp) * 1000).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </strong>
                </span>
              )}
              {caseItem.reporter_bond && BigInt(caseItem.reporter_bond) > 0n && (
                <span className="text-[#B45309] font-semibold bg-[#FEF3C7] px-1.5 py-0.5 rounded border border-[#FDE68A]">
                  Anti-Spam Bond: {formatGen(caseItem.reporter_bond)} GEN
                </span>
              )}
            </div>
          )}
        </div>

        {/* Protected Scope Snippet */}
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#111827] flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#6B7280]" />
              <span>Protected Trade Secret Scope:</span>
            </span>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[11px] text-[#4B5563] hover:text-[#111827] flex items-center gap-0.5 font-medium cursor-pointer"
            >
              <span>{expanded ? 'Fold' : 'Unfold'}</span>
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
          <div
            className={`p-3 bg-[#FFFFFF] border border-[#E5E5E0] rounded-md font-mono text-[11px] text-[#374151] leading-relaxed whitespace-pre-wrap ${
              expanded ? '' : 'line-clamp-3'
            }`}
          >
            {caseItem.nda_scope}
          </div>
        </div>

        {/* Evidence Link Section (if reported) */}
        {caseItem.evidence_url && (
          <div className="mt-3.5 p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-md text-xs">
            <div className="flex items-center justify-between font-semibold text-[#991B1B] text-[11px]">
              <span className="flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-[#B91C1C]" />
                Reported Leak URL on Public Web:
              </span>
              <a
                href={caseItem.evidence_url}
                target="_blank"
                rel="noreferrer"
                className="text-[#B91C1C] hover:underline flex items-center gap-1 text-[10px]"
              >
                <span>Inspect Evidence</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="mt-1 font-mono text-[11px] text-[#7F1D1D] truncate">
              {caseItem.evidence_url}
            </div>
          </div>
        )}

        {/* AI Rationale Snippet if available */}
        {caseItem.reason && caseItem.status !== 0 && (
          <div className="mt-3.5 p-3 bg-[#F9F8F6] border border-[#E5E5E0] rounded-md text-xs text-[#374151] font-sans">
            <span className="font-bold text-[#111827] block text-[10px] uppercase tracking-wider mb-0.5">
              Consensus Adjudication Rationale:
            </span>
            <p className="line-clamp-2 italic text-[#4B5563]">"{caseItem.reason}"</p>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="mt-5 pt-3.5 border-t border-[#E5E5E0] flex flex-wrap items-center justify-between gap-2.5">
        <div>
          {/* Whistleblower Action */}
          {caseItem.status === 0 && (
            <button
              onClick={() => onReportLeak(caseItem)}
              disabled={isActionPending}
              className="px-3.5 py-1.5 rounded-md bg-[#FEF2F2] hover:bg-[#FEE2E2] border border-[#FCA5A5] text-[#B91C1C] text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
            >
              <span>Submit Leak Report</span>
            </button>
          )}

          {/* Trigger AI Adjudication */}
          {caseItem.status === 1 && (
            <button
              onClick={() => onAdjudicateLeak(caseItem)}
              disabled={isActionPending}
              className="px-4 py-2 rounded-md bg-[#111827] hover:bg-[#1F2937] text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
            >
              <Cpu className="w-3.5 h-3.5 text-[#86EFAC]" />
              <span>Convene AI Jury Court</span>
            </button>
          )}

          {/* View Official Verdict */}
          {(caseItem.status === 2 || caseItem.verdict === 'NO_BREACH') && (
            <button
              onClick={() => onViewJuryReport(caseItem)}
              className="px-3.5 py-1.5 rounded-md bg-[#FFFFFF] hover:bg-[#F3F4F6] border border-[#E5E5E0] text-xs font-semibold text-[#111827] transition flex items-center gap-1.5 cursor-pointer"
            >
              <Scale className="w-3.5 h-3.5 text-[#15803D]" />
              <span>Inspect Court Verdict</span>
            </button>
          )}
        </div>

        {/* Secondary Actions */}
        <div className="flex items-center gap-2">
          {caseItem.status === 0 && isIssuer && (
            <button
              onClick={() => onCloseAndReclaim(caseItem)}
              disabled={isActionPending}
              className="px-3 py-1.5 rounded-md bg-[#FFFFFF] hover:bg-[#F3F4F6] border border-[#E5E5E0] text-xs font-medium text-[#4B5563] hover:text-[#111827] transition flex items-center gap-1 disabled:opacity-50 cursor-pointer"
              title="Reclaim escrowed funds if contract term has expired without breach"
            >
              <RotateCcw className="w-3 h-3 text-[#6B7280]" />
              <span>Reclaim Bond</span>
            </button>
          )}

          {caseItem.reason && (
            <button
              onClick={() => onViewJuryReport(caseItem)}
              className="text-xs text-[#6B7280] hover:text-[#111827] font-medium cursor-pointer"
            >
              Full Ledger Record →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
