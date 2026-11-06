import type {Priorities} from '../lib/priorities.ts';
import type {IssueKey, Rubric} from '../types.ts';

interface Props {
  rubric: Rubric;
  priorities: Priorities;
  onChange: (issue: IssueKey, weight: number) => void;
}

const LABELS = ['Ignore', 'Low', 'Normal', 'High'];

export function PriorityPanel({rubric, priorities, onChange}: Props) {
  return (
    <details className="panel priorities">
      <summary>My priorities</summary>
      <p className="muted">
        How much each issue counts toward the citizen index. Issue bars on
        member pages aren’t affected.
      </p>
      {rubric.categories.map(cat => (
        <fieldset key={cat.key} className="priority-group">
          <legend>{cat.title}</legend>
          {rubric.issues
            .filter(i => i.category === cat.key)
            .map(i => {
              const w = priorities[i.key] ?? 1;
              return (
                <label key={i.key} className="priority-row">
                  <span>{i.title}</span>
                  <input
                    type="range"
                    min={0}
                    max={3}
                    step={1}
                    value={w}
                    onChange={e => onChange(i.key, Number(e.target.value))}
                  />
                  <span className="muted">{LABELS[w]}</span>
                </label>
              );
            })}
        </fieldset>
      ))}
    </details>
  );
}
