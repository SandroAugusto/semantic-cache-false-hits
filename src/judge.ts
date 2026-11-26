import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface Verdict {
  /** The judge's answer; false when the reply could not be parsed (conservative: no cache hit). */
  same: boolean;
  /** Model time reported by Ollama (total_duration), in milliseconds. */
  latencyMs: number;
  valid: boolean;
  raw: string;
}

interface JudgeOptions {
  model: string;
  promptName: string;
  systemPrompt: string;
  host: string;
  cachePath: string;
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: { same: { type: 'boolean' } },
  required: ['same'],
};

/**
 * Asks a small local LLM (through Ollama's /api/chat) whether two questions can share one answer.
 * Uses temperature 0 and a JSON schema for the reply. Verdicts are cached on disk.
 */
export class OllamaJudge {
  readonly name: string;
  private readonly options: JudgeOptions;
  private cache: Record<string, Verdict> | undefined;
  private warmedUp = false;

  constructor(options: JudgeOptions) {
    this.options = options;
    this.name = `${options.model} (${options.promptName})`;
  }

  async judge(a: string, b: string): Promise<Verdict> {
    const cache = await this.loadCache();
    const key = createHash('sha256')
      .update([this.options.model, this.options.systemPrompt, a, b].join('\u0000'))
      .digest('hex');
    if (cache[key]) return cache[key];

    // The first call loads the model into memory; keep that out of the latency numbers.
    if (!this.warmedUp) {
      await this.request('Question A: ping\nQuestion B: ping');
      this.warmedUp = true;
    }

    const { content, totalDurationNs } = await this.request(`Question A: ${a}\nQuestion B: ${b}`);
    let verdict: Verdict;
    try {
      const parsed = JSON.parse(content) as { same?: unknown };
      if (typeof parsed.same !== 'boolean') throw new Error('missing boolean "same"');
      verdict = { same: parsed.same, latencyMs: totalDurationNs / 1e6, valid: true, raw: content };
    } catch {
      verdict = { same: false, latencyMs: totalDurationNs / 1e6, valid: false, raw: content };
    }

    cache[key] = verdict;
    await this.saveCache();
    return verdict;
  }

  private async request(userMessage: string): Promise<{ content: string; totalDurationNs: number }> {
    const response = await fetch(`${this.options.host}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.options.model,
        stream: false,
        format: RESPONSE_SCHEMA,
        options: { temperature: 0 },
        messages: [
          { role: 'system', content: this.options.systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    });
    if (!response.ok) {
      throw new Error(
        `Ollama returned ${response.status}: ${await response.text()}\n` +
          `If the model is not downloaded yet: ollama pull ${this.options.model}`,
      );
    }
    const data = (await response.json()) as { message?: { content?: string }; total_duration?: number };
    return { content: data.message?.content ?? '', totalDurationNs: data.total_duration ?? 0 };
  }

  private async loadCache(): Promise<Record<string, Verdict>> {
    if (this.cache) return this.cache;
    try {
      this.cache = JSON.parse(await readFile(this.options.cachePath, 'utf8')) as Record<string, Verdict>;
    } catch {
      this.cache = {};
    }
    return this.cache;
  }

  private async saveCache(): Promise<void> {
    await mkdir(dirname(this.options.cachePath), { recursive: true });
    await writeFile(this.options.cachePath, JSON.stringify(this.cache));
  }
}
