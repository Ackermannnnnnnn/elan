import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { zxingWasmPath } from "./barcode-reader";

describe("décodeur de codes-barres", () => {
  it("le fichier WebAssembly servi par l'application est celui de la version installée", () => {
    const root = process.cwd();
    const { version } = JSON.parse(
      readFileSync(join(root, "node_modules/zxing-wasm/package.json"), "utf8"),
    ) as { version: string };
    const served = readFileSync(join(root, "public", zxingWasmPath(version)));
    const installed = readFileSync(
      join(root, "node_modules/zxing-wasm/dist/reader/zxing_reader.wasm"),
    );
    // En cas d'échec après une mise à jour : copier le nouveau fichier dans public/vendor.
    expect(served.equals(installed)).toBe(true);
  });
});
