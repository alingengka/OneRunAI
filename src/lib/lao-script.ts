// ElevenLabs Scribe recognises Lao speech but renders it in Thai script
// (verified against real Lao audio: language_code=lao still returns Thai text).
// These helpers convert that output back into Lao script.

const CONSONANTS: Record<string, string> = {
  "ก": "ກ", "ข": "ຂ", "ฃ": "ຂ", "ค": "ຄ", "ฅ": "ຄ", "ฆ": "ຄ", "ง": "ງ",
  "จ": "ຈ", "ฉ": "ສ", "ช": "ຊ", "ซ": "ຊ", "ฌ": "ຊ", "ญ": "ຍ", "ย": "ຍ",
  "ฎ": "ດ", "ด": "ດ", "ฏ": "ຕ", "ต": "ຕ", "ฐ": "ຖ", "ถ": "ຖ",
  "ฑ": "ທ", "ฒ": "ທ", "ท": "ທ", "ธ": "ທ", "ณ": "ນ", "น": "ນ",
  "บ": "ບ", "ป": "ປ", "ผ": "ຜ", "ฝ": "ຝ", "พ": "ພ", "ภ": "ພ", "ฟ": "ຟ",
  "ม": "ມ", "ร": "ຣ", "ล": "ລ", "ฬ": "ລ", "ว": "ວ",
  "ศ": "ສ", "ษ": "ສ", "ส": "ສ", "ห": "ຫ", "ฮ": "ຮ", "อ": "ອ",
};

const MARKS: Record<string, string> = {
  "ะ": "ະ", "ั": "ັ", "า": "າ", "ำ": "ຳ", "ิ": "ິ", "ี": "ີ", "ึ": "ຶ", "ื": "ື",
  "ุ": "ຸ", "ู": "ູ", "เ": "ເ", "แ": "ແ", "โ": "ໂ", "ใ": "ໃ", "ไ": "ໄ",
  "็": "ົ", "่": "່", "้": "້", "๊": "໊", "๋": "໋", "ๆ": "ໆ", "ฯ": "ຯ",
  "๐": "໐", "๑": "໑", "๒": "໒", "๓": "໓", "๔": "໔",
  "๕": "໕", "๖": "໖", "๗": "໗", "๘": "໘", "๙": "໙",
};

const THAI_CONSONANT = /[ก-ฮ]/;

// Thai syllable-final consonants collapse to Lao's small final inventory.
const FINALS: Record<string, string> = {
  "ก": "ກ", "ข": "ກ", "ค": "ກ", "ฆ": "ກ",
  "จ": "ດ", "ช": "ດ", "ซ": "ດ", "ฎ": "ດ", "ฏ": "ດ", "ฐ": "ດ", "ฑ": "ດ", "ฒ": "ດ",
  "ด": "ດ", "ต": "ດ", "ถ": "ດ", "ท": "ດ", "ธ": "ດ", "ศ": "ດ", "ษ": "ດ", "ส": "ດ",
  "ญ": "ນ", "ณ": "ນ", "น": "ນ", "ร": "ນ", "ล": "ນ", "ฬ": "ນ",
  "บ": "ບ", "ป": "ບ", "ผ": "ບ", "ฝ": "ບ", "พ": "ບ", "ฟ": "ບ", "ภ": "ບ",
  "ง": "ງ", "ม": "ມ", "ย": "ຍ", "ว": "ວ",
};


/** Convert a Thai-script rendering of Lao speech into Lao script. */
export function thaiToLaoScript(input: string): string {
  if (!input) return "";
  let text = input.normalize("NFC");

  // Silent letters: Thai karan silences the preceding consonant, and a second
  // one when the syllable already has a written final (จันทน์ -> จัน).
  text = text.replace(/([ก-ฮ])([ก-ฮ])\u0e4c/g, (match, first: string, second: string) =>
    THAI_CONSONANT.test(first) && THAI_CONSONANT.test(second) ? "" : match);
  text = text.replace(/[ก-ฮ]\u0e4c/g, "");
  // Lao has no initial r-cluster: ประ -> ປະ
  text = text.replace(/([ก-ฮ])ร(?=[ะัาำิีึืุู])/g, "$1");
  // เ-ีย / เ-ือ diphthongs map onto single Lao vowels.
  text = text.replace(/เ([ก-ฮ])ี?ย/g, "$1\u0ebd");
  text = text.replace(/เ([ก-ฮ])ื?อ/g, "$1\u0ebc\u0ead");
  // -ัว -> Lao ..ົວ
  text = text.replace(/([ก-ฮ])ัว/g, "$1\u0ebb\u0ea7");
  // เ-าะ / -อ -> Lao ໍ
  text = text.replace(/เ([ก-ฮ])าะ/g, "$1\u0ecd");
  text = text.replace(/([ก-ฮ])อ(?![ก-ฮ])/g, "$1\u0ecd");
  // เ-า -> Lao ເ..ົາ
  text = text.replace(/เ([ก-ฮ])า/g, "\u0ec0$1\u0ebb\u0eb2");

  const characters = [...text];
  const leadVowels = new Set(["เ", "แ", "โ", "ใ", "ไ"]);
  let out = "";
  let sawVowel = false;
  for (let index = 0; index < characters.length; index++) {
    const char = characters[index] ?? "";
    const next = characters[index + 1] ?? "";
    if (leadVowels.has(char)) {
      sawVowel = false;
      out += MARKS[char] ?? char;
      continue;
    }
    if (CONSONANTS[char]) {
      const isFinal = sawVowel
        && char !== "ห" && char !== "อ"
        && FINALS[char] !== undefined
        && !/[\u0e30-\u0e4e]/.test(next);
      if (isFinal) {
        out += FINALS[char];
        sawVowel = false;
      } else {
        out += CONSONANTS[char];
      }
      continue;
    }
    if (MARKS[char]) {
      out += MARKS[char];
      if (!/[\u0e48-\u0e4b]/.test(char)) sawVowel = true;
      continue;
    }
    if (THAI_CONSONANT.test(char) || /[\u0e30-\u0e4f]/.test(char)) continue;
    if (/[\u0eb0-\u0ebd\u0ec0-\u0ecd]/.test(char)) sawVowel = true;
    else if (/\s/.test(char)) sawVowel = false;
    out += char;
  }
  return out.normalize("NFC").replace(/\s+/g, " ").trim();
}



/** Share of non-space characters that are Lao. */
export function laoScriptPurity(text: string): number {
  const symbols = [...text].filter((char) => !/\s/.test(char));
  if (!symbols.length) return 0;
  return symbols.filter((char) => /[\u0e80-\u0eff]/.test(char)).length / symbols.length;
}
