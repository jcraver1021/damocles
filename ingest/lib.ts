import {mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {format, resolveConfig} from 'prettier';

export const ROOT = join(import.meta.dirname, '..');
export const RAW_DIR = join(ROOT, 'data', 'raw');
export const PUBLIC_DATA_DIR = join(ROOT, 'public', 'data');

const prettierConfig = resolveConfig(
  join(ROOT, 'public', 'data', 'x.json')
).then(c => c ?? {});

const today = new Date().toISOString().slice(0, 10);

/** Fetch via a dated snapshot in data/raw/<source>/<date>/ (reused unless REFRESH=1). */
export async function fetchTextSnapshot(
  source: string,
  url: string,
  fileName = url.split('/').pop() || 'response'
): Promise<string> {
  const file = join(RAW_DIR, source, today, fileName);
  if (!process.env.REFRESH) {
    try {
      return await readFile(file, 'utf8');
    } catch {
      // No snapshot yet.
    }
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${source}: GET ${url} -> ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  await mkdir(dirname(file), {recursive: true});
  await writeFile(file, text);
  return text;
}

export async function fetchJsonSnapshot<T>(
  source: string,
  url: string,
  fileName?: string
): Promise<T> {
  return JSON.parse(await fetchTextSnapshot(source, url, fileName)) as T;
}

/** Minimal RFC 4180 CSV parser. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows;
  return body
    .filter(r => r.length > 1 || r[0] !== '')
    .map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

/** Writes Prettier-formatted JSON, so `check-format` covers generated data. */
export async function writeJson(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), {recursive: true});
  const options = await prettierConfig;
  await writeFile(
    path,
    await format(JSON.stringify(data), {...options, parser: 'json'})
  );
}

export async function resetDir(path: string): Promise<void> {
  await rm(path, {recursive: true, force: true});
  await mkdir(path, {recursive: true});
}
