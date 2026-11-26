import { readFile } from 'node:fs/promises';
import { parseCsv } from './csv.ts';

/**
 * Medical Question Pairs (McCreery et al., KDD 2020): 1,524 real patient questions, each with a
 * doctor-written rewrite that keeps the intent (label 1) and a related question whose answer
 * would be wrong or irrelevant, written with similar keywords (label 0).
 * https://github.com/curai/medical-question-pair-dataset
 *
 * The repository has no license file, so the data is downloaded at run time, never committed.
 */
export const MQP_URL =
  'https://raw.githubusercontent.com/curai/medical-question-pair-dataset/master/mqp.csv';

export interface MqpItem {
  /** Index of the original question, stable across runs. */
  id: number;
  original: string;
  /** Same intent, different wording: the cache should reuse the original's answer. */
  positive: string;
  /** Related, similar keywords, different answer: the cache must not reuse it. */
  negative: string;
}

export async function loadMqp(source: string): Promise<MqpItem[]> {
  let text: string;
  if (/^https?:\/\//.test(source)) {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`Could not download ${source}: HTTP ${response.status}`);
    text = await response.text();
  } else {
    text = await readFile(source, 'utf8');
  }

  // No header row: dr_id, question_1, question_2, label.
  const byOriginal = new Map<string, { positive?: string; negative?: string }>();
  for (const cells of parseCsv(text)) {
    if (cells.length < 4) continue;
    const [, original, other, label] = cells.map((c) => c.trim());
    const entry = byOriginal.get(original) ?? {};
    if (label === '1') entry.positive ??= other;
    else if (label === '0') entry.negative ??= other;
    byOriginal.set(original, entry);
  }

  const items: MqpItem[] = [];
  for (const [original, { positive, negative }] of byOriginal) {
    if (positive && negative) items.push({ id: items.length, original, positive, negative });
  }
  return items;
}

/** Deterministic shuffle (mulberry32 + Fisher-Yates), so samples are reproducible. */
export function seededShuffle<T>(values: T[], seed: number): T[] {
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...values];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
