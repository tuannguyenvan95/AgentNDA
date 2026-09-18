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
          label: 'Cleared / No Breach',
          badgeClass: 'press-tag press-tag-forest',
          bgClass: 'bg-forest-subtle',
          textClass: 'text-forest',
          borderClass: 'border-forest-border',
          icon: 'shield-check',
        };
      }
      return {
        label: 'Active & Secure',
        badgeClass: 'press-tag press-tag-forest',
        bgClass: 'bg-forest-subtle',
        textClass: 'text-forest',
        borderClass: 'border-[#E5E5E0]',
        icon: 'shield',
      };
    case 1:
      return {
        label: 'In Audit / Investigating',
        badgeClass: 'press-tag press-tag-amber',
        bgClass: 'bg-amber-subtle',
        textClass: 'text-amber',
        borderClass: 'border-amber-border',
        icon: 'alert-triangle',
      };
    case 2:
      return {
        label: 'Breach Confirmed',
        badgeClass: 'press-tag press-tag-crimson',
        bgClass: 'bg-crimson-subtle',
        textClass: 'text-crimson',
        borderClass: 'border-crimson-border',
        icon: 'alert-octagon',
      };
    case 3:
      return {
        label: 'Expired / Reclaimed',
        badgeClass: 'press-tag press-tag-neutral',
        bgClass: 'bg-[#F3F4F6]',
        textClass: 'text-ink-secondary',
        borderClass: 'border-[#E5E5E0]',
        icon: 'check-circle-2',
      };
    default:
      return {
        label: 'Status Unknown',
        badgeClass: 'press-tag press-tag-neutral',
        bgClass: 'bg-[#F3F4F6]',
        textClass: 'text-ink-muted',
        borderClass: 'border-[#E5E5E0]',
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
