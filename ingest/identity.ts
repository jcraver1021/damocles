// Resolves any member reference (bioguide, FEC ID, or elect-<FEC ID>) to the
// member records it belongs to. One person can have two records, e.g. a
// House member who is also a senator-elect; evidence goes to both.

import type {Member} from '../src/types.ts';

export function aliases(m: Member): string[] {
  return [
    ...new Set([
      m.id,
      ...(m.ids.bioguide ? [m.ids.bioguide] : []),
      ...m.ids.fec,
      ...m.ids.fec.map(f => `elect-${f}`),
    ]),
  ];
}

export class Identity {
  private byAlias = new Map<string, string[]>();

  constructor(members: Member[]) {
    for (const m of members) {
      for (const a of aliases(m)) {
        this.byAlias.set(a, [...(this.byAlias.get(a) ?? []), m.id]);
      }
    }
  }

  /** Member record ids for a reference; empty if unknown. */
  resolve(ref: string): string[] {
    return this.byAlias.get(ref) ?? [];
  }

  has(ref: string): boolean {
    return this.byAlias.has(ref);
  }
}
