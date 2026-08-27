import { describe, expect, it } from "vitest";
import { laoScriptPurity, thaiToLaoScript } from "./lao-script";

describe("thaiToLaoScript", () => {
  it("converts a verified Scribe response for Lao audio into Lao script", () => {
    // Live ElevenLabs Scribe output for Lao speech saying
    // "ປະເທດລາວ ພາສາ ວຽງຈັນ ສະບາຍດີ".
    expect(thaiToLaoScript("ประเทศลาว ภาษาเวียงจันทน์ สบายดี"))
      .toBe("ປະເທດລາວ ພາສາວຽງຈັນ ສບາຍດີ");
  });

  it("leaves text that is already Lao untouched in script purity", () => {
    expect(laoScriptPurity("ສະບາຍດີ")).toBe(1);
    expect(laoScriptPurity("สบายดี")).toBe(0);
  });

  it("maps syllable-final consonants and drops silent karan letters", () => {
    expect(thaiToLaoScript("จันทน์")).toBe("ຈັນ");
    expect(thaiToLaoScript("ลาว")).toBe("ລາວ");
  });
});
