import {useCallback, useState} from 'react';

/** useState persisted in sessionStorage, so filters survive navigation. */
export function useSessionState<T>(
  key: string,
  initial: T
): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    const raw = sessionStorage.getItem(key);
    return raw === null ? initial : (JSON.parse(raw) as T);
  });
  const set = useCallback(
    (v: T) => {
      sessionStorage.setItem(key, JSON.stringify(v));
      setValue(v);
    },
    [key]
  );
  return [value, set];
}
