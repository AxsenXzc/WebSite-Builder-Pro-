const encoder = new TextEncoder();

/** Conteggio byte di una stringa: identico in Node e nel browser (niente Buffer). */
export function byteLength(value: string): number {
  return encoder.encode(value).length;
}

export function readableBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
