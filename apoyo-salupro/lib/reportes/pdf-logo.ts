import { readFileSync } from "fs";
import { join } from "path";

let cachedLogoDataUrl: string | null = null;

/** Logo horizontal SaluPro en base64 para jsPDF.addImage. */
export function getSaluProLogoDataUrl(): string {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;
  const filePath = join(process.cwd(), "public", "logo_salupro_light.png");
  const base64 = readFileSync(filePath).toString("base64");
  cachedLogoDataUrl = `data:image/png;base64,${base64}`;
  return cachedLogoDataUrl;
}
