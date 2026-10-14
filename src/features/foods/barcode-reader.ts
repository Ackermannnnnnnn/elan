/**
 * Lecture de codes-barres depuis la caméra, dans tous les navigateurs :
 *  · lecteur intégré du navigateur s'il existe (Chrome Android, Edge…) ;
 *  · sinon ZXing compilé en WebAssembly (bibliothèque libre, licence MIT),
 *    chargé seulement à l'ouverture de la caméra et servi par l'application
 *    elle-même (public/vendor), sans service tiers.
 */

export const BARCODE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"] as const;

export type BarcodeReader = {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
};

type NativeDetector = {
  new (options: { formats: string[] }): BarcodeReader;
  getSupportedFormats?: () => Promise<string[]>;
};

/** Emplacement public du fichier WebAssembly de ZXing (copié depuis node_modules). */
export const zxingWasmPath = (version: string) => `/vendor/zxing-${version}/zxing_reader.wasm`;

export async function createBarcodeReader(): Promise<BarcodeReader> {
  const formats = [...BARCODE_FORMATS];
  const Native = (window as unknown as { BarcodeDetector?: NativeDetector }).BarcodeDetector;
  if (Native) {
    try {
      const supported = (await Native.getSupportedFormats?.()) ?? formats;
      if (formats.some((format) => supported.includes(format))) return new Native({ formats });
    } catch {
      // Lecteur intégré inutilisable : on passe à ZXing.
    }
  }
  const { BarcodeDetector, ZXING_WASM_VERSION, prepareZXingModule } =
    await import("barcode-detector/ponyfill");
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) =>
        path.endsWith(".wasm") ? zxingWasmPath(ZXING_WASM_VERSION) : prefix + path,
    },
  });
  return new BarcodeDetector({ formats });
}
