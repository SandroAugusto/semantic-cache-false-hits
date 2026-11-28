/**
 * Ollama model tags (`qwen2.5:3b`) can be re-pointed to new weights. Caches and reports
 * use the digest Ollama reports for the tag instead, so a cached verdict or embedding is
 * reused only for the exact weights that produced it, and a report says which weights ran.
 */

export interface LocalModel {
  name?: string;
  model?: string;
  digest?: string;
}

/** The digest of `model` in Ollama's local model list (GET /api/tags). A tag with no `:` means `:latest`. */
export function findDigest(models: readonly LocalModel[], model: string): string {
  const wanted = model.includes(':') ? model : `${model}:latest`;
  const found = models.find((m) => m.name === wanted || m.model === wanted);
  if (!found?.digest) {
    throw new Error(`Model "${model}" is not in Ollama's local list. Download it first: ollama pull ${model}`);
  }
  return found.digest;
}

/** Asks the Ollama server at `host` for the digest of `model`. */
export async function modelDigest(host: string, model: string): Promise<string> {
  const response = await fetch(`${host}/api/tags`);
  if (!response.ok) throw new Error(`Ollama returned ${response.status} for /api/tags`);
  const data = (await response.json()) as { models?: LocalModel[] };
  return findDigest(data.models ?? [], model);
}

/** Short form for reports: the first 12 hex digits, as `docker images` shows them. */
export const shortDigest = (digest: string): string => digest.replace(/^sha256:/, '').slice(0, 12);
