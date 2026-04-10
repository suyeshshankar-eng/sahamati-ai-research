export async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const { extractText } = await import("unpdf");
  const result = await extractText(buffer);
  return Array.isArray(result.text) ? result.text.join("\n") : result.text;
}
