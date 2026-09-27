import JSZip from "jszip";
import { renderSite, type ExportFile } from "./render-site";
import { byteLength } from "@/lib/util/bytes";
import type { Site } from "@/lib/schema/site";

/** Crea lo ZIP del sito: stessa struttura dell'export, in un singolo file. */
export async function buildSiteZip(site: Site, files?: ExportFile[]): Promise<Blob> {
  const list = files ?? renderSite(site);
  const zip = new JSZip();
  const root = zip.folder(site.slug || "sito") ?? zip;

  for (const file of list) {
    root.file(file.path, file.contents);
  }

  return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function downloadText(contents: string, filename: string, type = "text/html;charset=utf-8"): void {
  downloadBlob(new Blob([contents], { type }), filename);
}

export function archiveSummary(files: ExportFile[]): { files: number; bytes: number } {
  return {
    files: files.length,
    bytes: files.reduce((total, file) => total + byteLength(file.contents), 0),
  };
}
