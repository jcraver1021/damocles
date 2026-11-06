import {useState} from 'react';
import type {Member} from '../types.ts';

interface Props {
  member: Pick<Member, 'photoUrl' | 'name'>;
  width: number;
  height: number;
}

/** Falls back to initials; newer members often lack a photo. */
export function Photo({member, width, height}: Props) {
  const [failed, setFailed] = useState(false);
  if (failed || !member.photoUrl) {
    return (
      <span
        className="photo-fallback"
        style={{width, height}}
        aria-hidden="true"
      >
        {member.name.first[0]}
        {member.name.last[0]}
      </span>
    );
  }
  return (
    <img
      className="photo"
      src={member.photoUrl}
      alt=""
      loading="lazy"
      width={width}
      height={height}
      onError={() => setFailed(true)}
    />
  );
}
