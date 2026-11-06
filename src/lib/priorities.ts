import {useCallback, useState} from 'react';
import type {IssueKey} from '../types.ts';

export type Priorities = Partial<Record<IssueKey, number>>;

const KEY = 'damocles.priorities';

function read(): Priorities {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Priorities;
  } catch {
    return {};
  }
}

/** Per-issue weights 0-3 (default 1), in localStorage. */
export function usePriorities(): [
  Priorities,
  (issue: IssueKey, weight: number) => void,
] {
  const [priorities, setState] = useState<Priorities>(read);
  const set = useCallback((issue: IssueKey, weight: number) => {
    setState(prev => {
      const next = {...prev, [issue]: weight};
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);
  return [priorities, set];
}
