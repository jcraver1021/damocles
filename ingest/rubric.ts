// Loads and validates config/rubric.yaml.

import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {parse} from 'yaml';
import type {Rubric} from '../src/types.ts';
import {ROOT} from './lib.ts';

const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

const REF_PATTERN = /^(vote:\d+-(house|senate)-\d+|bill:[a-z]+\d+-\d+)$/;

export async function loadRubric(): Promise<Rubric> {
  const rubric = parse(
    await readFile(join(ROOT, 'config', 'rubric.yaml'), 'utf8')
  ) as Rubric;
  const errors: string[] = [];

  rubric.categories ??= [];
  const categoryKeys = new Set<string>();
  for (const c of rubric.categories) {
    if (!KEY_PATTERN.test(c.key)) errors.push(`bad category key "${c.key}"`);
    if (categoryKeys.has(c.key)) errors.push(`duplicate category "${c.key}"`);
    if (!c.title) errors.push(`category ${c.key}: missing title`);
    categoryKeys.add(c.key);
  }
  const issueKeys = new Set<string>();
  for (const issue of rubric.issues) {
    if (!KEY_PATTERN.test(issue.key)) {
      errors.push(`bad issue key "${issue.key}" (use lowercase snake_case)`);
    }
    if (issueKeys.has(issue.key)) errors.push(`duplicate issue "${issue.key}"`);
    issueKeys.add(issue.key);
    if (!categoryKeys.has(issue.category)) {
      errors.push(`${issue.key}: unknown category "${issue.category}"`);
    }
    for (const field of ['title', 'shortTitle', 'goal'] as const) {
      if (!issue[field]) errors.push(`${issue.key}: missing ${field}`);
    }
    issue.anchors ??= [];
    issue.scorecards ??= [];
    issue.statementPositions ??= [];
    for (const c of issue.scorecards) {
      if (!c.key || !/^[a-z0-9-]+$/.test(c.key)) {
        errors.push(
          `${issue.key}: scorecard "${c.name}" needs a key (a-z, 0-9, -)`
        );
      }
      if (c.polarity !== 'aligned' && c.polarity !== 'inverted') {
        errors.push(
          `${issue.key}: scorecard "${c.name}" polarity must be aligned|inverted`
        );
      }
    }
    for (const a of issue.anchors) {
      if (!REF_PATTERN.test(a.ref))
        errors.push(`${issue.key}: bad anchor ref "${a.ref}"`);
      if (a.alignedPosition !== 'yes' && a.alignedPosition !== 'no') {
        errors.push(
          `${issue.key}: anchor ${a.ref} needs alignedPosition yes|no`
        );
      }
    }
  }

  if (errors.length)
    throw new Error(`config/rubric.yaml is invalid:\n  ${errors.join('\n  ')}`);
  return rubric;
}
