import type {CitizenIndex} from '../lib/citizenIndex.ts';
import type {Rubric} from '../types.ts';

export function CategoryBars({
  index,
  rubric,
}: {
  index: CitizenIndex;
  rubric: Rubric;
}) {
  const titles = new Map(rubric.categories.map(c => [c.key, c.title]));
  return (
    <div className="category-bars">
      {index.byCategory.map(c => (
        <div
          key={c.category}
          className="category-bar"
          title={`${titles.get(c.category)}: ${c.value ?? 'no data'} (${c.scoredIssues}/${c.totalIssues} issues scored${c.aggregate === 'min' ? '; weakest issue counts' : ''})`}
        >
          <span className="category-bar-label">{titles.get(c.category)}</span>
          <span
            className={`category-bar-track${c.value === null ? ' empty' : ''}`}
          >
            {c.value !== null && (
              <span
                className={`category-bar-fill band-fill-${c.value >= 65 ? 'ally' : c.value >= 40 ? 'mixed' : 'opposed'}`}
                style={{width: `${c.value}%`}}
              />
            )}
          </span>
          <span className="category-bar-value">{c.value ?? '–'}</span>
        </div>
      ))}
    </div>
  );
}
