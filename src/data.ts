import {useEffect, useState} from 'react';
import type {
  MemberDetail,
  MembersIndex,
  ResolvedCampaign,
  Rubric,
} from './types.ts';

type Loadable<T> =
  | {status: 'loading'}
  | {status: 'error'; error: string}
  | {status: 'ok'; data: T};

const cache = new Map<string, Promise<unknown>>();

function loadJson<T>(path: string): Promise<T> {
  const url = `${import.meta.env.BASE_URL}data/${path}`;
  let p = cache.get(url);
  if (!p) {
    p = fetch(url).then(r => {
      if (!r.ok) throw new Error(`${r.status} loading ${path}`);
      return r.json();
    });
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p as Promise<T>;
}

function useJson<T>(path: string): Loadable<T> {
  const [state, setState] = useState<{path: string; value: Loadable<T>}>({
    path,
    value: {status: 'loading'},
  });
  useEffect(() => {
    let live = true;
    loadJson<T>(path).then(
      data => live && setState({path, value: {status: 'ok', data}}),
      (e: Error) =>
        live && setState({path, value: {status: 'error', error: e.message}})
    );
    return () => {
      live = false;
    };
  }, [path]);
  return state.path === path ? state.value : {status: 'loading'};
}

export const useMembers = () => useJson<MembersIndex>('members.json');
export const useRubric = () => useJson<Rubric>('rubric.json');
export const useCampaigns = () => useJson<ResolvedCampaign[]>('campaigns.json');
export const useMemberDetail = (id: string) =>
  useJson<MemberDetail>(`members/${id}.json`);
