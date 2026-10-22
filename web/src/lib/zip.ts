// Liest ZIP-Archive direkt im Browser (ohne Bibliothek).
// Unterstützt "gespeichert" (0) und "Deflate" (8), das sind praktisch alle ZIPs von Windows und macOS.

export interface ZipEntry {
  name: string;
  text: () => Promise<string>;
}

export async function readZip(file: Blob): Promise<ZipEntry[]> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(buf.buffer);

  // Ende des Inhaltsverzeichnisses suchen (am Dateiende, vor einem optionalen Kommentar).
  let end = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error('Die Datei ist kein gültiges ZIP-Archiv.');

  const count = view.getUint16(end + 10, true);
  let pos = view.getUint32(end + 16, true);
  const utf8 = new TextDecoder();
  const entries: ZipEntry[] = [];

  for (let i = 0; i < count; i++) {
    if (view.getUint32(pos, true) !== 0x02014b50) throw new Error('Das ZIP-Archiv ist beschädigt.');
    const method = view.getUint16(pos + 10, true);
    const size = view.getUint32(pos + 20, true);
    const nameLen = view.getUint16(pos + 28, true);
    const extraLen = view.getUint16(pos + 30, true);
    const commentLen = view.getUint16(pos + 32, true);
    const local = view.getUint32(pos + 42, true);
    const name = utf8.decode(buf.subarray(pos + 46, pos + 46 + nameLen));
    pos += 46 + nameLen + extraLen + commentLen;

    if (name.endsWith('/') || name.startsWith('__MACOSX/')) continue;
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = buf.subarray(start, start + size);

    entries.push({
      name,
      text: async () => {
        if (method === 0) return utf8.decode(data);
        if (method !== 8) throw new Error(`${name}: Komprimierung wird nicht unterstützt.`);
        const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new Response(stream).text();
      },
    });
  }
  return entries;
}
