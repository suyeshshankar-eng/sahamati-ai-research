export async function extractPlainText(buffer: ArrayBuffer): Promise<string> {
  return new TextDecoder().decode(buffer);
}
