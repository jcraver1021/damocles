// Data model shared by ingest/ and the app. Types only.

/** Defined in config/rubric.yaml. */
export type IssueKey = string;
export type CategoryKey = string;

export type Chamber = 'house' | 'senate';

/** e.g. "us-ca" for state legislatures later. */
export type Jurisdiction = 'us-federal' | `us-${string}`;

export interface MemberIds {
  /** Missing for most members-elect. */
  bioguide?: string;
  fec: string[];
  opensecrets?: string;
  votesmart?: number;
  govtrack?: number;
  icpsr?: number; // Voteview
  lis?: string; // Senate roll-call XML
  ballotpedia?: string;
  wikipedia?: string;
  wikidata?: string;
}

export interface Term {
  chamber: Chamber;
  start: string;
  end: string;
  state: string;
  district?: number; // House only; 0 = at-large
  senateClass?: number;
  party: string;
}

export type MemberStatus = 'serving' | 'elect';

export interface Tenure {
  /** Start of current continuous service. */
  chamberSince: string;
  congressSince: string;
  yearsInChamber: number;
  yearsInCongress: number;
  /** 1 = most senior. Approximate. */
  seniorityRank: number;
  freshman: boolean;
}

export interface Departure {
  reason: 'defeated' | 'retiring' | 'other-office' | 'other';
  successorId?: string;
  effective: string;
}

export interface FinanceSummary {
  cycle: number;
  candidateId: string;
  receipts: number;
  individualTotal: number;
  /** Only with FEC_API_KEY. */
  individualItemized?: number;
  /** Under $200: small donors. */
  individualUnitemized?: number;
  pacContributions: number;
  partyContributions: number;
  candidateSelfFunding: number;
  coverageEnd: string;
  sourceUrl: string;
}

export interface Member {
  /** bioguide, or "elect-<FEC id>" for members-elect. */
  id: string;
  status: MemberStatus;
  jurisdiction: Jurisdiction;
  ids: MemberIds;
  name: {first: string; last: string; full: string};
  chamber: Chamber;
  state: string;
  district?: number;
  party: string;
  caucus: string;
  /** False for delegates. */
  votingMember: boolean;
  termStart: string;
  termEnd: string;
  tenure?: Tenure;
  departure?: Departure;
  /** Members-elect only: */
  replaces?: string;
  priorOffice?: string;
  electionSource?: {status: 'projected' | 'certified'; url: string};
  finance?: FinanceSummary;
  website?: string;
  contactForm?: string;
  phone?: string;
  office?: string;
  photoUrl?: string;
  social: {x?: string; facebook?: string; youtube?: string; instagram?: string};
}

export type EvidenceKind =
  | 'vote'
  | 'sponsorship'
  | 'statement'
  | 'debate'
  | 'interview'
  | 'website'
  | 'rating'
  | 'finance';

/** -2 (opposed) to +2 (aligned). */
export type Stance = number;

export interface Evidence {
  id: string;
  memberId: string;
  issue: IssueKey;
  kind: EvidenceKind;
  stance: Stance;
  summary: string;
  quote?: string; // verbatim
  sourceUrl: string;
  sourceDate: string;
  method: 'deterministic' | 'llm' | 'human';
  confidence: number; // 0..1
  weight?: number;
  reviewed: boolean;
  /** "Didn't sign on" evidence. */
  absence?: boolean;
  vote?: VoteDetail;
  rating?: RatingDetail;
}

export interface RatingDetail {
  source: string;
  congress: number;
  /** 0-100 as published. */
  score: number;
  polarity: 'aligned' | 'inverted';
}

export interface VoteDetail {
  ref: string;
  chamber: Chamber;
  congress: number;
  rollnumber: number;
  question: string;
  position: 'Yea' | 'Nay';
  result: string;
  yea: number;
  nay: number;
}

export interface IssueScore {
  issue: IssueKey;
  /** -1..1, or null without enough evidence. */
  score: number | null;
  coverage: number;
  evidenceCount: number;
  /** Statements and actions disagree. */
  saysVsDoesGap: boolean;
}

// ---- Rubric (config/rubric.yaml documents each field) ----

export interface AnchorAction {
  ref: string;
  label: string;
  alignedPosition: 'yes' | 'no';
  weight?: number;
}

export interface ScorecardSource {
  key: string;
  name: string;
  url: string;
  file?: string;
  dataUrl?: string;
  polarity: 'aligned' | 'inverted';
  notes?: string;
}

export interface IssueCategory {
  key: CategoryKey;
  title: string;
  description?: string;
  aggregate?: 'mean' | 'min';
}

export interface IssueRubric {
  key: IssueKey;
  category: CategoryKey;
  title: string;
  shortTitle: string;
  goal: string;
  statementPositions: string[];
  anchors: AnchorAction[];
  scorecards: ScorecardSource[];
  financeMetrics?: string[];
  kindWeights?: Partial<Record<EvidenceKind, number>>;
  minEvidenceWeight?: number;
  nonCosponsorEvidence?: boolean;
}

export interface Rubric {
  version: number;
  updated: string;
  categories: IssueCategory[];
  issues: IssueRubric[];
}

// ---- Published data files (public/data) ----

export interface IndexedMember extends Member {
  scores: IssueScore[];
}

export interface MembersIndex {
  generatedAt: string;
  source: string;
  members: IndexedMember[];
}

// ---- Campaigns (config/campaigns.yaml documents each field) ----

export type CampaignOutcome = 'open' | 'success' | 'partial' | 'failure';
export type MilestoneStatus = 'pending' | 'met' | 'missed';

export type CampaignStance = 'committed' | 'leaning' | 'undecided' | 'opposed'; // backs the target

export interface CampaignAudience {
  chamber: Chamber;
  caucus: string;
  session: 'current' | 'incoming';
  description: string;
}

export interface CampaignThreshold {
  kind: 'block-floor-majority' | 'caucus-majority';
  chamberSize?: number;
  partialAt?: number;
}

export interface Milestone {
  id: string;
  title: string;
  description?: string;
  date?: string;
  status: MilestoneStatus;
  sourceUrl?: string;
}

export interface CampaignPosition {
  memberId: string;
  stance: CampaignStance;
  date: string;
  sourceUrl: string;
  quote?: string;
  quoteVerified?: boolean;
}

export interface Campaign {
  id: string;
  title: string;
  ask: string;
  goal: string;
  audience: CampaignAudience;
  threshold: CampaignThreshold;
  successCriteria: string;
  partialCriteria: string;
  failureCriteria: string;
  outcome: CampaignOutcome;
  outcomeNote?: string;
  milestones: Milestone[];
  positions: CampaignPosition[];
  notes?: string;
}

/** With audience resolved by ingest. */
export interface ResolvedCampaign extends Campaign {
  audienceIds: string[];
  needed: number;
  counts: Record<CampaignStance, number>;
}

export interface MemberDetail {
  member: Member;
  terms: Term[];
  scores: IssueScore[];
  evidence: Evidence[];
}
