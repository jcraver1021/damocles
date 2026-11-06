import type {
  CampaignOutcome,
  CampaignStance,
  MilestoneStatus,
} from '../types.ts';

export const STANCE_LABELS: Record<CampaignStance, string> = {
  committed: 'Committed',
  leaning: 'Leaning',
  undecided: 'Undecided / no public position',
  opposed: 'Backs the target',
};

export const OUTCOME_LABELS: Record<CampaignOutcome, string> = {
  open: 'In progress',
  success: 'Succeeded',
  partial: 'Partial success',
  failure: 'Failed',
};

export const MILESTONE_ICONS: Record<MilestoneStatus, string> = {
  pending: '○',
  met: '●',
  missed: '✕',
};
