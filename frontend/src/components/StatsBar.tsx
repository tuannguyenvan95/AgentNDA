import React from 'react';
import { Lock, AlertOctagon, ShieldCheck, Globe } from 'lucide-react';
import { ProtocolStats } from '../config/genlayer';
import { formatGen } from '../utils/helpers';

interface StatsBarProps {
  stats: ProtocolStats;
  activeCount: number;
}

export const StatsBar: React.FC<StatsBarProps> = ({ stats, activeCount }) => {
  return (
    <div className="bg-[#FFFFFF] border border-[#E5E5E0] rounded-xl shadow-xs overflow-hidden">
      {/* Editorial Section Subhead */}
      <div className="bg-[#F5F4F0] px-4 py-2 border-b border-[#E5E5E0] flex items-center justify-between text-[11px] font-mono text-[#4B5563] uppercase tracking-wider">
        <span>INDEX & PROTOCOL DISPATCH TELEMETRY</span>
        <span className="text-[#15803D] font-bold flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#15803D]" />
          STUDIONET SYNCHRONIZED
        </span>
      </div>

      {/* 4-column metric ticker with dividing borders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#E5E5E0]">
        {/* Metric 1: Total Bounty in Escrow */}
        <div className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
            <span>Escrow Pool Value</span>
            <Lock className="w-4 h-4 text-[#111827]" />
          </div>
          <div className="mt-2.5">
            <div className="flex items-baseline gap-1.5">
              <span className="font-serif font-bold text-2xl text-[#111827]">
                {formatGen(stats.total_bounty_locked)}
              </span>
              <span className="text-xs font-mono font-bold text-[#6B7280]">GEN</span>
            </div>
            <p className="mt-1 text-[11px] text-[#9CA3AF] font-sans">
              Locked in active bond contracts
            </p>
          </div>
        </div>

        {/* Metric 2: Settled Breaches */}
        <div className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
            <span>Breaches Confirmed</span>
            <AlertOctagon className="w-4 h-4 text-[#B91C1C]" />
          </div>
          <div className="mt-2.5">
            <div className="flex items-baseline gap-1.5">
              <span className="font-serif font-bold text-2xl text-[#B91C1C]">
                {stats.total_breaches_settled}
              </span>
              <span className="text-xs font-sans text-[#6B7280]">cases</span>
            </div>
            <p className="mt-1 text-[11px] text-[#9CA3AF] font-sans">
              Bounties forfeited & settled
            </p>
          </div>
        </div>

        {/* Metric 3: Active NDA Dockets */}
        <div className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
            <span>Active Dockets</span>
            <ShieldCheck className="w-4 h-4 text-[#15803D]" />
          </div>
          <div className="mt-2.5">
            <div className="flex items-baseline gap-1.5">
              <span className="font-serif font-bold text-2xl text-[#15803D]">
                {activeCount}
              </span>
              <span className="text-xs font-sans text-[#6B7280]">/ {stats.total_cases} total</span>
            </div>
            <p className="mt-1 text-[11px] text-[#9CA3AF] font-sans">
              Monitored for canary exposure
            </p>
          </div>
        </div>

        {/* Metric 4: AI Consensus Engine */}
        <div className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
            <span>Autonomous Web Court</span>
            <Globe className="w-4 h-4 text-[#111827]" />
          </div>
          <div className="mt-2.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#15803D]" />
              <span className="font-serif font-bold text-lg text-[#111827]">
                Live Web Scraper
              </span>
            </div>
            <p className="mt-1 text-[11px] text-[#6B7280] font-mono truncate">
              gl.nondet.web.render
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
