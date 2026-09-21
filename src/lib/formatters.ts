export interface PnLDisplay {
  text: string;
  colorClass: string;
  isPositive: boolean;
  isNegative: boolean;
}

export function formatPnL(val: number | undefined | null, decimals = 2): PnLDisplay {
  if (val === undefined || val === null || isNaN(val)) {
    return { text: '---', colorClass: 'text-neutral-500', isPositive: false, isNegative: false };
  }
  const num = Number(val);
  if (num > 0.00001) {
    return {
      text: `+${num.toFixed(decimals)}`,
      colorClass: 'text-emerald-400 font-semibold',
      isPositive: true,
      isNegative: false,
    };
  } else if (num < -0.00001) {
    return {
      text: num.toFixed(decimals),
      colorClass: 'text-rose-400 font-semibold',
      isPositive: false,
      isNegative: true,
    };
  } else {
    return {
      text: (0).toFixed(decimals),
      colorClass: 'text-neutral-400 font-semibold',
      isPositive: false,
      isNegative: false,
    };
  }
}

export function formatNumber(val: number | undefined | null, decimals = 2): string {
  if (val === undefined || val === null || isNaN(val)) return '---';
  return Number(val).toFixed(decimals);
}

export function formatInteger(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return '0';
  return Math.round(Number(val)).toLocaleString();
}
