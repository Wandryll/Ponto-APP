import { describe, expect, it } from "vitest";

import { safeSpreadsheetText } from "@/lib/report-export";

describe("safeSpreadsheetText", () => {
  it("neutraliza fórmulas em campos textuais", () => {
    expect(safeSpreadsheetText('=HYPERLINK("https://example.com")')).toBe(
      `'${'=HYPERLINK("https://example.com")'}`,
    );
    expect(safeSpreadsheetText("+Equipe")).toBe("'+Equipe");
    expect(safeSpreadsheetText("Equipe DCT")).toBe("Equipe DCT");
  });
});
