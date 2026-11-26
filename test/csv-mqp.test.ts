import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { parseCsv } from '../src/csv.ts';
import { loadMqp, seededShuffle } from '../src/mqp.ts';

test('csv: quoted fields with commas, escaped quotes and newlines', () => {
  const rows = parseCsv('a,"b, c","say ""hi"""\r\n1,"two\nlines",3\n');
  assert.deepEqual(rows, [
    ['a', 'b, c', 'say "hi"'],
    ['1', 'two\nlines', '3'],
  ]);
});

test('mqp: groups each original with its rewrite and related question, skips incomplete ones', async () => {
  const path = join(tmpdir(), 'mqp-test.csv');
  await writeFile(
    path,
    ['1,Q one,Q one rewritten,1', '1,Q one,Q one related,0', '2,Q two,Only a rewrite,1'].join('\n'),
  );
  const items = await loadMqp(path);
  assert.equal(items.length, 1);
  assert.deepEqual(items[0], { id: 0, original: 'Q one', positive: 'Q one rewritten', negative: 'Q one related' });
});

test('shuffle: same seed, same order; still a permutation', () => {
  const input = Array.from({ length: 20 }, (_, i) => i);
  assert.deepEqual(seededShuffle(input, 7), seededShuffle(input, 7));
  assert.notDeepEqual(seededShuffle(input, 7), seededShuffle(input, 8));
  assert.deepEqual([...seededShuffle(input, 7)].sort((a, b) => a - b), input);
});
