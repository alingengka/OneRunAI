import { laoScriptPurity, thaiToLaoScript } from "./lao-script";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// Live ElevenLabs Scribe output for Lao speech saying
// "ປະເທດລາວ ພາສາ ວຽງຈັນ ສະບາຍດີ" (Scribe renders Lao in Thai script).
const scribeOutput = "ประเทศลาว ภาษาเวียงจันทน์ สบายดี";
const converted = thaiToLaoScript(scribeOutput);
assert(converted === "ປະເທດລາວ ພາສາວຽງຈັນ ສບາຍດີ", `unexpected transliteration: ${converted}`);

assert(thaiToLaoScript("จันทน์") === "ຈັນ", "karan letters must be dropped");
assert(thaiToLaoScript("ลาว") === "ລາວ", "final ว must map to ວ");
assert(laoScriptPurity("ສະບາຍດີ") === 1, "Lao text must be fully pure");
assert(laoScriptPurity("สบายดี") === 0, "Thai text must have zero Lao purity");

console.log("lao-script tests passed");
