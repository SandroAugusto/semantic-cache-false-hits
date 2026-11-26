import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface Embedder {
  /** Identifies the configuration (model + prefix) in reports and in the on-disk cache. */
  readonly name: string;
  embed(texts: string[]): Promise<number[][]>;
}

interface OllamaOptions {
  model: string;
  /** Task prefix. nomic-embed-text was trained with prefixes such as "search_query: ". */
  prefix: string;
  host: string;
  cachePath: string;
}

/**
 * Embeddings through Ollama's HTTP API (POST /api/embed), with no dependencies.
 * Vectors are cached on disk, so reruns never call the model for texts it has already seen.
 */
export class OllamaEmbedder implements Embedder {
  readonly name: string;
  private readonly options: OllamaOptions;
  private cache: Record<string, number[]> | undefined;

  constructor(options: OllamaOptions) {
    this.options = options;
    this.name = `${options.model} | prefix: ${options.prefix ? JSON.stringify(options.prefix) : 'none'}`;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const cache = await this.loadCache();
    const keyOf = (text: string) =>
      createHash('sha256').update(`${this.options.model}\u0000${this.options.prefix}\u0000${text}`).digest('hex');

    const missing = [...new Set(texts.filter((text) => !cache[keyOf(text)]))];
    if (missing.length > 0) {
      const vectors = await this.request(missing.map((text) => this.options.prefix + text));
      missing.forEach((text, i) => {
        cache[keyOf(text)] = vectors[i];
      });
      await this.saveCache();
    }

    return texts.map((text) => cache[keyOf(text)]);
  }

  private async request(input: string[]): Promise<number[][]> {
    let response: Response;
    try {
      response = await fetch(`${this.options.host}/api/embed`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: this.options.model, input }),
      });
    } catch (error) {
      throw new Error(`Could not reach Ollama at ${this.options.host}. Is it running? (ollama serve)\n${String(error)}`);
    }
    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Ollama returned ${response.status}: ${body}\n` +
          `If the model is not downloaded yet: ollama pull ${this.options.model}`,
      );
    }
    const data = (await response.json()) as { embeddings?: number[][] };
    if (!data.embeddings || data.embeddings.length !== input.length) {
      throw new Error('Ollama response has no embeddings or a different count than requested.');
    }
    return data.embeddings;
  }

  private async loadCache(): Promise<Record<string, number[]>> {
    if (this.cache) return this.cache;
    try {
      this.cache = JSON.parse(await readFile(this.options.cachePath, 'utf8')) as Record<string, number[]>;
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
