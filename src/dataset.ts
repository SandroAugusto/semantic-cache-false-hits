import { readFile } from 'node:fs/promises';
import { CATEGORIES, type Label, type Pair } from './types.ts';

const LABELS: readonly Label[] = ['same', 'different'];

export async function loadPairs(path: string): Promise<Pair[]> {
  const raw = await readFile(path, 'utf8');
  const pairs: Pair[] = [];
  const ids = new Set<string>();

  raw.split('\n').forEach((line, index) => {
    if (!line.trim()) return;
    const where = `${path}:${index + 1}`;
    const item = JSON.parse(line) as Partial<Pair>;

    if (!item.id || !item.a || !item.b) throw new Error(`${where}: missing id, a or b`);
    if (!item.label || !LABELS.includes(item.label)) throw new Error(`${where}: invalid label (${item.label})`);
    if (!item.category || !CATEGORIES.includes(item.category)) {
      throw new Error(`${where}: invalid category (${item.category})`);
    }
    if ((item.category === 'paraphrase') !== (item.label === 'same')) {
      throw new Error(`${where}: only paraphrases can be labeled "same"`);
    }
    if (ids.has(item.id)) throw new Error(`${where}: duplicate id (${item.id})`);

    ids.add(item.id);
    pairs.push(item as Pair);
  });

  return pairs;
}
