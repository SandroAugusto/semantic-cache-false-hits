/**
 * Draws results/tradeoff.svg: paraphrases reused (y) against hard negatives accepted (x).
 * The line is the threshold-only cache across thresholds; the markers are threshold + judge.
 * The ideal cache sits in the top-left corner.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { parseCsvRecords as parseCsv } from './csv.ts';

const { values } = parseArgs({
  options: {
    out: { type: 'string', default: 'results' },
    sweep: { type: 'string', default: 'nomic-embed-text__no-prefix' },
    threshold: { type: 'string', default: '0.60' },
  },
});

const sweep = parseCsv(await readFile(join(values.out!, values.sweep!, 'sweep.csv'), 'utf8'));
const pipeline = parseCsv(await readFile(join(values.out!, 'verification', 'pipeline.csv'), 'utf8')).filter(
  // One marker per judge as first asked (A then B); the both-orders policies are in the report table.
  (r) => r.threshold === values.threshold && r.policy !== 'threshold only' && !r.policy.endsWith(', both orders'),
);

// Geometry.
const W = 760;
const H = 500;
const M = { top: 64, right: 210, bottom: 64, left: 72 };
const PW = W - M.left - M.right;
const PH = H - M.top - M.bottom;
const x = (v: number) => M.left + v * PW;
const y = (v: number) => M.top + (1 - v) * PH;
const f = (n: number) => n.toFixed(1);

// Series identity: color = judge model (fixed categorical order), shape = prompt.
const SLOTS = ['s2', 's3', 's4', 's5', 's6'];
const splitPolicy = (policy: string) => {
  const match = /^(.*) \((\w+)\)$/.exec(policy);
  return match ? { model: match[1], prompt: match[2] } : { model: policy, prompt: 'plain' };
};
const models = [...new Set(pipeline.map((r) => splitPolicy(r.policy).model))];
const slotOf = (model: string) => SLOTS[models.indexOf(model) % SLOTS.length];

const parts: string[] = [];
parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t d">`);
parts.push('<title id="t">Paraphrases reused vs. hard negatives accepted</title>');
parts.push(
  '<desc id="d">The threshold-only line never gets near the top-left corner: every threshold that reuses paraphrases also accepts most hard negatives. Markers show threshold plus an LLM judge.</desc>',
);
parts.push(`<style>
  svg { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
  .surface { fill: #ffffff; } .text { fill: #191919; } .muted { fill: #666666; }
  .grid { stroke: #e6e6e6; stroke-width: 1; } .axis { stroke: #b3b3b3; stroke-width: 1; }
  .l1 { stroke: #257de0; fill: none; } .s1 { fill: #257de0; } .s2 { fill: #f47230; } .s3 { fill: #00b894; } .s4 { fill: #f2a600; }
  .s5 { fill: #ee7fac; } .s6 { fill: #008a17; } .ring { stroke: #ffffff; stroke-width: 2; }
  @media (prefers-color-scheme: dark) {
    .surface { fill: #191919; } .text { fill: #efefef; } .muted { fill: #9c9c9c; }
    .grid { stroke: #333333; } .axis { stroke: #555555; }
    .l1 { stroke: #338ced; } .s1 { fill: #338ced; } .s2 { fill: #e76624; } .s3 { fill: #00a888; } .s4 { fill: #d28e05; }
    .s5 { fill: #e24d8b; } .s6 { fill: #0aac23; } .ring { stroke: #191919; }
  }
</style>`);
parts.push(`<rect class="surface" width="${W}" height="${H}" rx="8"/>`);
parts.push(`<text class="text" x="${M.left}" y="28" font-size="16" font-weight="600">Reusing paraphrases without serving wrong answers</text>`);
parts.push(`<text class="muted" x="${M.left}" y="48" font-size="12">nomic-embed-text, no prefix. Ideal cache: top-left corner.</text>`);

// Grid and axes.
for (let t = 0; t <= 1.0001; t += 0.25) {
  parts.push(`<line class="grid" x1="${f(x(0))}" x2="${f(x(1))}" y1="${f(y(t))}" y2="${f(y(t))}"/>`);
  parts.push(`<line class="grid" x1="${f(x(t))}" x2="${f(x(t))}" y1="${f(y(0))}" y2="${f(y(1))}"/>`);
  parts.push(`<text class="muted" x="${f(M.left - 8)}" y="${f(y(t) + 4)}" font-size="11" text-anchor="end">${Math.round(t * 100)}%</text>`);
  parts.push(`<text class="muted" x="${f(x(t))}" y="${f(y(0) + 18)}" font-size="11" text-anchor="middle">${Math.round(t * 100)}%</text>`);
}
parts.push(`<line class="axis" x1="${f(x(0))}" x2="${f(x(1))}" y1="${f(y(0))}" y2="${f(y(0))}"/>`);
parts.push(`<text class="muted" x="${f(x(0.5))}" y="${H - 18}" font-size="12" text-anchor="middle">Hard negatives accepted (wrong answers served)</text>`);
parts.push(`<text class="muted" transform="translate(18 ${f(y(0.5))}) rotate(-90)" font-size="12" text-anchor="middle">Paraphrases reused (savings)</text>`);

// Threshold-only line (stepwise points across the sweep, in threshold order).
const linePoints = sweep.map((r) => `${f(x(Number(r.hard_negative_false_hit_rate)))},${f(y(Number(r.hit_rate)))}`);
parts.push(`<polyline class="l1" stroke-width="2" stroke-linejoin="round" points="${linePoints.join(' ')}"/>`);
for (const t of ['0.60', '0.75', '0.85']) {
  const r = sweep.find((row) => row.threshold === t);
  if (!r) continue;
  const px = x(Number(r.hard_negative_false_hit_rate));
  const py = y(Number(r.hit_rate));
  parts.push(`<circle class="s1 ring" cx="${f(px)}" cy="${f(py)}" r="4"/>`);
  parts.push(`<text class="muted" x="${f(px - 8)}" y="${f(py - 8)}" font-size="11" text-anchor="end">t=${t}</text>`);
}

// Judge markers. Points at the same spot are nudged apart so every marker stays visible.
const seen = new Map<string, number>();
for (const r of pipeline) {
  const { model, prompt: promptLabel } = splitPolicy(r.policy);
  const cx0 = x(Number(r.hard_negative_false_hit_rate));
  const cy0 = y(Number(r.hit_rate));
  const key = `${f(cx0)}:${f(cy0)}`;
  const n = seen.get(key) ?? 0;
  seen.set(key, n + 1);
  const cx = cx0 + n * 11;
  const cy = cy0;
  const cls = `${slotOf(model)} ring`;
  if (promptLabel.startsWith('guided')) {
    parts.push(`<rect class="${cls}" x="${f(cx - 5)}" y="${f(cy - 5)}" width="10" height="10" rx="2"/>`);
  } else {
    parts.push(`<circle class="${cls}" cx="${f(cx)}" cy="${f(cy)}" r="5.5"/>`);
  }
}

// Legend.
const lx = W - M.right + 24;
let ly = M.top + 4;
parts.push(`<line class="l1" x1="${lx}" x2="${lx + 18}" y1="${ly}" y2="${ly}" stroke-width="2"/>`);
parts.push(`<text class="text" x="${lx + 26}" y="${ly + 4}" font-size="12">Threshold only</text>`);
ly += 26;
parts.push(`<text class="muted" x="${lx}" y="${ly + 4}" font-size="11">Threshold ${values.threshold} + judge:</text>`);
ly += 20;
for (const model of models) {
  parts.push(`<circle class="${slotOf(model)}" cx="${lx + 9}" cy="${ly}" r="5.5"/>`);
  parts.push(`<text class="text" x="${lx + 26}" y="${ly + 4}" font-size="12">${model}</text>`);
  ly += 20;
}
ly += 6;
parts.push(`<circle class="muted" cx="${lx + 9}" cy="${ly}" r="5"/>`);
parts.push(`<text class="text" x="${lx + 26}" y="${ly + 4}" font-size="12">plain prompt</text>`);
ly += 20;
parts.push(`<rect class="muted" x="${lx + 4}" y="${ly - 5}" width="10" height="10" rx="2"/>`);
parts.push(`<text class="text" x="${lx + 26}" y="${ly + 4}" font-size="12">guided prompt</text>`);

parts.push('</svg>');
await writeFile(join(values.out!, 'tradeoff.svg'), parts.join('\n') + '\n');
console.log(`Chart written to ${join(values.out!, 'tradeoff.svg')}`);
