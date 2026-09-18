import React from 'react';
import { ShieldCheck, AlertOctagon, Lock, Cpu, Globe } from 'lucide-react';
import { ProtocolStats } from '../config/genlayer';
import { formatGen } from '../utils/helpers';

interface StatsBarProps {
  stats: ProtocolStats;
  activeCount: number;
}

export const StatsBar: React.FC<StatsBarProps> = ({ stats, activeCount }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Metric 1: Total Bounty in Escrow */}
      <div className="glass-panel rounded-2xl p-5 relative overflow-hidden group hover:border-indigo-500/30 transition">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Bounty Locked
          </span>
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Lock className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-extrabold text-white font-mono">
            {formatGen(stats.total_bounty_locked)}
          </span>
          <span className="text-xs font-semibold text-indigo-400">GEN</span>
        </div>
        <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-1.5">
          <span>Native Escrow Pool</span>
        </div>
      </div>

      {/* Metric 2: Settled Breaches */}
      <div className="glass-panel rounded-2xl p-5 relative overflow-hidden group hover:border-rose-500/30 transition">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Breaches Adjudicated
          </span>
          <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <AlertOctagon className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-extrabold text-rose-400 font-mono">
            {stats.total_breaches_settled}
          </span>
          <span className="text-xs text-slate-400">cases</span>
        </div>
        <div className="mt-1 text-[11px] text-slate-500">
          Whistleblower bounties settled
        </div>
      </div>

      {/* Metric 3: Active Monitored NDAs */}
      <div className="glass-panel rounded-2xl p-5 relative overflow-hidden group hover:border-emerald-500/30 transition">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Active NDA Escrows
          </span>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-extrabold text-emerald-400 font-mono">
            {activeCount}
          </span>
          <span className="text-xs text-slate-400">/ {stats.total_cases} total</span>
        </div>
        <div className="mt-1 text-[11px] text-slate-500">
          Monitored on Studionet
        </div>
      </div>

      {/* Metric 4: AI Consensus Engine Status */}
      <div className="glass-panel rounded-2xl p-5 relative overflow-hidden group hover:border-cyan-500/30 transition">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            AI Jury Court
          </span>
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Cpu className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <span className="text-sm font-bold text-white">Live Web Reader</span>
        </div>
        <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
          <Globe className="w-3 h-3 text-cyan-400 inline" />
          <span>gl.nondet.web.render active</span>
        </div>
      </div>
    </div>
  );
};
