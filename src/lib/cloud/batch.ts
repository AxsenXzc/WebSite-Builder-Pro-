/**
 * Suddivisione dei lotti.
 *
 * La busta firmata ha un tetto di dimensioni: un utente con molti progetti non
 * può spingerli tutti in una richiesta. I lotti vengono tagliati per peso
 * stimato (JSON del sito incluso), non per numero di righe.
 */

export function chunkBySize<T>(rows: T[], sizeOf: (row: T) => number, maxChars = 1_500_000): T[][] {
  if (rows.length === 0) return [];
  const chunks: T[][] = [];
  let current: T[] = [];
  let currentSize = 2;

  for (const row of rows) {
    const size = sizeOf(row) + 1;
    if (current.length > 0 && currentSize + size > maxChars) {
      chunks.push(current);
      current = [];
      currentSize = 2;
    }
    current.push(row);
    currentSize += size;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

/** Peso stimato di un valore una volta serializzato, senza serializzarlo due volte. */
export function jsonSize(value: unknown): number {
  try {
    return JSON.stringify(value)?.length ?? 0;
  } catch {
    return 0;
  }
}
