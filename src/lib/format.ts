import type {Member} from '../types.ts';

export function seatLabel(
  m: Pick<Member, 'chamber' | 'state' | 'district'>
): string {
  if (m.chamber === 'senate') return `${m.state} · Senate`;
  return `${m.state}-${m.district === 0 || m.district === undefined ? 'AL' : m.district}`;
}

export function partyCode(party: string): string {
  return party.startsWith('Dem') ? 'D' : party.startsWith('Rep') ? 'R' : 'I';
}

export function formatYear(iso: string): string {
  return iso.slice(0, 4);
}

export function formatYears(n: number): string {
  if (n < 1) return 'under 1 yr';
  return `${Math.floor(n)} yr${Math.floor(n) === 1 ? '' : 's'}`;
}

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});
export const formatUsd = (n: number) => usd.format(n);

export const formatPct = (n: number) => `${Math.round(n * 100)}%`;
