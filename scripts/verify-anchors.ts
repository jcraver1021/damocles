// Checks rubric anchors: parsed vote tallies must match Voteview's official
// counts, and each bill must exist (its title is printed beside the label).

import {loadBill, parseBillRef} from '../ingest/bills.ts';
import {loadRubric} from '../ingest/rubric.ts';
import {ingestAnchorVotes} from '../ingest/voteview.ts';

const rubric = await loadRubric();
let failures = 0;

const evidence = await ingestAnchorVotes(rubric);
const seen = new Set<string>();
const tallies = new Map<
  string,
  {yea: number; nay: number; official: [number, number]}
>();
for (const e of evidence) {
  const v = e.vote!;
  // A vote can anchor several issues; count each member once.
  const key = `${v.ref}:${e.memberId}`;
  if (seen.has(key)) continue;
  seen.add(key);
  const t = tallies.get(v.ref) ?? {yea: 0, nay: 0, official: [v.yea, v.nay]};
  if (v.position === 'Yea') t.yea++;
  else t.nay++;
  tallies.set(v.ref, t);
}
for (const [ref, t] of [...tallies].sort()) {
  const ok = t.yea === t.official[0] && t.nay === t.official[1];
  if (!ok) {
    failures++;
    console.log(
      `MISMATCH ${ref}: parsed ${t.yea}-${t.nay}, official ${t.official[0]}-${t.official[1]}`
    );
  }
}
console.log(
  `Votes: ${tallies.size} roll calls checked, ${failures} mismatched.`
);

const bills = rubric.issues.flatMap(i =>
  i.anchors.filter(a => a.ref.startsWith('bill:')).map(a => ({issue: i.key, a}))
);
let missing = 0;
for (const {issue, a} of bills) {
  const ref = parseBillRef(a.ref)!;
  try {
    const bill = await loadBill(ref);
    const signers = (bill.sponsor ? 1 : 0) + bill.cosponsors.length;
    console.log(
      `  ${a.ref.padEnd(22)} ${String(signers).padStart(3)} signers  ${issue.padEnd(20)} "${bill.title.slice(0, 70)}"  <- ${a.label}`
    );
  } catch (err) {
    missing++;
    console.log(`MISSING  ${a.ref} (${a.label}): ${(err as Error).message}`);
  }
}
console.log(
  `Bills: ${bills.length} checked, ${missing} missing. Compare each official title with its label above.`
);

if (failures || missing) process.exit(1);
