/**
 * AgentNDA - Utility helper functions
 */

export function formatAddress(address: string): string {
  if (!address || address === '0x0000000000000000000000000000000000000000') {
    return 'None';
  }
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatGen(weiValue: string | bigint | number): string {
  try {
    const b = BigInt(weiValue.toString());
    if (b === 0n) return '0.00';

    const negative = b < 0n;
    const absVal = negative ? -b : b;
    const whole = absVal / 1000000000000000000n;
    const fraction = absVal % 1000000000000000000n;

    // Pad fraction to 18 digits
    const fractionStr = fraction.toString().padStart(18, '0');
    // Take first 4 decimal places
    const trimmedFraction = fractionStr.slice(0, 4);

    return `${negative ? '-' : ''}${whole.toString()}.${trimmedFraction}`;
  } catch (e) {
    return '0.00';
  }
}

export function parseGen(genStr: string): bigint {
  const clean = genStr.trim();
  if (!clean || isNaN(Number(clean)) || Number(clean) <= 0) {
    return 0n;
  }
  const parts = clean.split('.');
  const whole = BigInt(parts[0] || '0');
  let fraction = 0n;

  if (parts.length > 1) {
    const fractionStr = parts[1].slice(0, 18).padEnd(18, '0');
    fraction = BigInt(fractionStr);
  }

  return whole * 1000000000000000000n + fraction;
}

export interface StatusMeta {
  label: string;
  badgeClass: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  icon: string;
}

export function getStatusMeta(status: number, verdict?: string): StatusMeta {
  switch (status) {
    case 0:
      if (verdict === 'NO_BREACH') {
        return {
          label: 'Active (False Alarm Cleared)',
          badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          bgClass: 'bg-emerald-500/5',
          textClass: 'text-emerald-400',
          borderClass: 'border-emerald-500/30',
          icon: 'shield-check',
        };
      }
      return {
        label: 'Active & Secure',
        badgeClass: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
        bgClass: 'bg-indigo-500/5',
        textClass: 'text-indigo-400',
        borderClass: 'border-indigo-500/30',
        icon: 'shield',
      };
    case 1:
      return {
        label: 'In Audit (Jury Convened)',
        badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse',
        bgClass: 'bg-amber-500/5',
        textClass: 'text-amber-400',
        borderClass: 'border-amber-500/30',
        icon: 'alert-triangle',
      };
    case 2:
      return {
        label: 'Breach Confirmed (Bounty Paid)',
        badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
        bgClass: 'bg-rose-500/5',
        textClass: 'text-rose-400',
        borderClass: 'border-rose-500/30',
        icon: 'alert-octagon',
      };
    case 3:
      return {
        label: 'Secure Term Expired (Reclaimed)',
        badgeClass: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
        bgClass: 'bg-slate-500/5',
        textClass: 'text-slate-400',
        borderClass: 'border-slate-500/30',
        icon: 'check-circle-2',
      };
    default:
      return {
        label: 'Unknown',
        badgeClass: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
        bgClass: 'bg-slate-500/5',
        textClass: 'text-slate-400',
        borderClass: 'border-slate-500/30',
        icon: 'help-circle',
      };
  }
}

export function getExplorerUrl(hashOrAddr: string, type: 'tx' | 'address' = 'tx'): string {
  if (type === 'address') {
    return `https://explorer-studio.genlayer.com/address/${hashOrAddr}`;
  }
  return `https://genlayer-explorer.vercel.app/tx/${hashOrAddr}`;
}
