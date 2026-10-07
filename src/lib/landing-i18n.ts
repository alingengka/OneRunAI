/** Landing page copy in Lao, Thai and English. */

export type Lang = "lo" | "th" | "en";

export const LANGS: { id: Lang; label: string }[] = [
  { id: "lo", label: "ລາວ" },
  { id: "th", label: "ไทย" },
  { id: "en", label: "EN" },
];

const STORAGE_KEY = "onerun-landing-lang";

/** The saved choice, else the device language (Lao, Thai, otherwise English). */
export function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "lo" || saved === "th" || saved === "en") return saved;
  } catch {
    // storage blocked: fall back to the device language
  }
  const langs =
    typeof navigator === "undefined" ? [] : (navigator.languages ?? [navigator.language]);
  for (const tag of langs) {
    const base = tag?.toLowerCase().split("-")[0];
    if (base === "lo" || base === "th") return base;
  }
  return "en";
}

export function saveLang(lang: Lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // not remembered this time
  }
}

type Item = { title: string; text: string };

export type LandingCopy = {
  nav: { features: string; how: string; pricing: string; faq: string };
  navLabel: string;
  langLabel: string;
  login: string;
  signup: string;
  billingLink: string;
  openApp: string;
  startFree: string;
  tryFree: (days: number) => string;
  minutes: (n: number) => string;
  hero: {
    badge: string;
    /** first headline line, split where it may wrap */
    line1: string[];
    accent: string;
    tail: string;
    subtitle: string;
    howButton: string;
    note: string;
  };
  features: { eyebrow: string; title: string; subtitle: string; items: Item[] };
  how: { eyebrow: string; title: string; steps: Item[] };
  pricing: {
    eyebrow: string;
    title: string;
    cycleLabel: string;
    monthly: string;
    yearly: string;
    twoMonthsFree: string;
    trialLabel: string;
    free: string;
    trialNote: (days: number) => string;
    trialButton: string;
    trialPoints: (minutes: string) => string[];
    popular: string;
    useCode: string;
    perMonth: string;
    perYear: string;
    proButton: (days: number) => string;
    proPoints: (minutes: string) => string[];
  };
  faqTitle: string;
  faq: { q: string; a: string }[];
  cta: { title: string; text: string };
  footer: { tagline: string; menu: string; account: string; emojiCredit: string };
};

const th: LandingCopy = {
  nav: { features: "ฟีเจอร์", how: "วิธีใช้", pricing: "ราคา", faq: "คำถาม" },
  navLabel: "เมนูหลัก",
  langLabel: "ภาษา",
  login: "เข้าสู่ระบบ",
  signup: "สมัครใช้งาน",
  billingLink: "ชำระเงิน",
  openApp: "เปิดแอป",
  startFree: "เริ่มฟรี",
  tryFree: (days) => `ทดลองใช้ฟรี ${days} วัน`,
  minutes: (n) => `${n.toLocaleString("en-US")} นาที`,
  hero: {
    badge: "AI Subtitle สำหรับคนทำคอนเทนต์ภาษาลาว",
    line1: ["ใส่ซับลาว", "ให้คลิป"],
    accent: "ไวรัล",
    tail: "ด้วย OneRun",
    subtitle:
      "อัปโหลดคลิป แล้วให้ AI ถอดเสียงลาวเป็นซับทีละคำ ใส่สไตล์ สติกเกอร์ และ B-roll ให้พร้อมโพสต์ TikTok, Reels และ Shorts",
    howButton: "ดูวิธีใช้",
    note: "ไม่ต้องผูกบัตร · ใช้ผ่านเบราว์เซอร์ได้ทั้งมือถือและคอม",
  },
  features: {
    eyebrow: "ฟีเจอร์",
    title: "ทุกอย่างที่คลิปสั้นต้องมี",
    subtitle: "ไม่ต้องสลับหลายแอป ใส่ซับ แต่งคลิป และส่งออกได้ในที่เดียว",
    items: [
      {
        title: "ซับภาษาลาวแม่นยำ",
        text: "AI หลายตัวช่วยกันถอดเสียงลาวเป็นอักษรลาวทีละคำ คำอังกฤษที่พูดปนก็ไม่หลุด",
      },
      {
        title: "ลดเสียงรบกวน",
        text: "กรองเสียงลม เสียงฮัม และปรับเสียงพูดให้ชัดขึ้นตอนส่งออกวิดีโอ",
      },
      { title: "สไตล์ซับพร้อมใช้", text: "Podcast สองบรรทัด ไฮไลต์คำ แถบสี และเปลี่ยนสีทีละคำได้" },
      {
        title: "อิโมจิและ Motion Graphic",
        text: "อิโมจิเคลื่อนไหว ลูกศร ปุ่ม Follow และสติกเกอร์ของคุณเอง",
      },
      {
        title: "B-roll ฟรีในคลิกเดียว",
        text: "AI แนะนำคำค้น แล้วเลือกวิดีโอและรูปฟรีใส่ในซีนได้ทันที",
      },
      {
        title: "แปลซับหลายภาษา",
        text: "แปลเป็นไทย ลาว หรืออังกฤษในคลิกเดียว เข้าถึงคนดูได้กว้างขึ้น",
      },
      {
        title: "ส่งออกถึง 4K",
        text: "เลือกความละเอียดและ FPS พร้อมซับหรือไม่มีซับ หรือส่งต่อเข้า CapCut",
      },
    ],
  },
  how: {
    eyebrow: "วิธีใช้",
    title: "3 ขั้นตอน คลิปพร้อมโพสต์",
    steps: [
      { title: "อัปโหลดคลิป", text: "เลือกไฟล์จากมือถือหรือคอม รองรับ MP4 และ MOV" },
      { title: "AI ใส่ซับให้", text: "ถอดเสียงลาวและจัดจังหวะคำให้อัตโนมัติ" },
      { title: "แต่งแล้วส่งออก", text: "เลือกสไตล์ ใส่สติกเกอร์และ B-roll แล้วโพสต์ได้เลย" },
    ],
  },
  pricing: {
    eyebrow: "ราคา",
    title: "เริ่มฟรี จ่ายเมื่อพร้อม",
    cycleLabel: "รอบการชำระ",
    monthly: "รายเดือน",
    yearly: "รายปี",
    twoMonthsFree: "ฟรี 2 เดือน",
    trialLabel: "ทดลองใช้",
    free: "ฟรี",
    trialNote: (days) => `${days} วัน · ไม่ต้องผูกบัตร`,
    trialButton: "เริ่มทดลองฟรี",
    trialPoints: (minutes) => [
      `AI ถอดเสียงรวม ${minutes}`,
      "ใช้ได้ทุกฟีเจอร์",
      "ส่งออกวิดีโอพร้อมซับ",
    ],
    popular: "ยอดนิยม",
    useCode: "ใช้โค้ด",
    perMonth: "ต่อเดือน",
    perYear: "ต่อปี",
    proButton: (days) => `ทดลองฟรี ${days} วันก่อน`,
    proPoints: (minutes) => [
      `AI ถอดเสียง ${minutes} ต่อเดือน`,
      "ทุกฟีเจอร์: สไตล์ สติกเกอร์ B-roll",
      "ส่งออกถึง 4K ไม่มีลายน้ำ",
      "ชำระผ่าน QR ธนาคาร",
    ],
  },
  faqTitle: "คำถามที่พบบ่อย",
  faq: [
    {
      q: "ทดลองใช้ฟรีต้องผูกบัตรไหม?",
      a: "ไม่ต้องครับ สมัครด้วยอีเมลแล้วใช้ได้ทุกฟีเจอร์ 5 วัน หมดแล้วเลือกได้ว่าจะสมัครต่อหรือไม่",
    },
    {
      q: "ชำระเงินยังไง?",
      a: "สแกน QR โอนผ่านแอปธนาคาร แล้วอัปโหลดสลิปในหน้าชำระเงิน ทีมงานตรวจสอบแล้วเปิดสิทธิ์ให้",
    },
    {
      q: "รองรับภาษาอะไรบ้าง?",
      a: "ถอดเสียงภาษาลาวเป็นหลัก รองรับไทยและอังกฤษ และแปลซับเป็นภาษาอื่นได้ในคลิกเดียว",
    },
    {
      q: "ใช้บนมือถือได้ไหม?",
      a: "ได้ครับ เปิดผ่านเบราว์เซอร์บน iPhone หรือ Android ได้เลย ไม่ต้องลงแอป",
    },
    {
      q: "นาทีถอดเสียงคืออะไร?",
      a: "คือความยาวเสียงที่ให้ AI ถอดเป็นซับ ทดลองใช้ได้ 30 นาที แพ็กเกจรายเดือนและรายปีได้ 300 นาทีต่อเดือน",
    },
  ],
  cta: {
    title: "พร้อมทำคลิปไวรัลหรือยัง?",
    text: "อัปโหลดคลิปแรกวันนี้ ใช้เวลาไม่ถึง 5 นาที แล้วโพสต์ได้เลย",
  },
  footer: {
    tagline: "เครื่องมือ AI ใส่ซับลาวและตัดคลิปสั้น สำหรับครีเอเตอร์ ร้านค้า และแบรนด์ในลาว",
    menu: "เมนู",
    account: "บัญชี",
    emojiCredit: "อิโมจิเคลื่อนไหว: Google Noto Emoji (CC BY 4.0)",
  },
};

const lo: LandingCopy = {
  nav: { features: "ຄຸນສົມບັດ", how: "ວິທີໃຊ້", pricing: "ລາຄາ", faq: "ຄຳຖາມ" },
  navLabel: "ເມນູຫຼັກ",
  langLabel: "ພາສາ",
  login: "ເຂົ້າສູ່ລະບົບ",
  signup: "ສະໝັກໃຊ້ງານ",
  billingLink: "ຊຳລະເງິນ",
  openApp: "ເປີດແອັບ",
  startFree: "ເລີ່ມຟຣີ",
  tryFree: (days) => `ທົດລອງໃຊ້ຟຣີ ${days} ມື້`,
  minutes: (n) => `${n.toLocaleString("en-US")} ນາທີ`,
  hero: {
    badge: "AI Subtitle ສຳລັບຄົນເຮັດຄອນເທັນພາສາລາວ",
    line1: ["ໃສ່ຊັບລາວ", "ໃຫ້ຄລິບ"],
    accent: "ໄວຣັລ",
    tail: "ດ້ວຍ OneRun",
    subtitle:
      "ອັບໂຫຼດຄລິບ ແລ້ວໃຫ້ AI ຖອດສຽງລາວເປັນຊັບເທື່ອລະຄຳ ໃສ່ສະໄຕລ໌ ສະຕິກເກີ ແລະ B-roll ໃຫ້ພ້ອມໂພສ TikTok, Reels ແລະ Shorts",
    howButton: "ເບິ່ງວິທີໃຊ້",
    note: "ບໍ່ຕ້ອງຜູກບັດ · ໃຊ້ຜ່ານບຣາວເຊີໄດ້ທັງມືຖືແລະຄອມ",
  },
  features: {
    eyebrow: "ຄຸນສົມບັດ",
    title: "ທຸກຢ່າງທີ່ຄລິບສັ້ນຕ້ອງມີ",
    subtitle: "ບໍ່ຕ້ອງສະຫຼັບຫຼາຍແອັບ ໃສ່ຊັບ ແຕ່ງຄລິບ ແລະສົ່ງອອກໄດ້ໃນບ່ອນດຽວ",
    items: [
      {
        title: "ຊັບພາສາລາວແມ່ນຍຳ",
        text: "AI ຫຼາຍໂຕຊ່ວຍກັນຖອດສຽງລາວເປັນອັກສອນລາວເທື່ອລະຄຳ ຄຳອັງກິດທີ່ເວົ້າປົນກໍບໍ່ຫຼຸດ",
      },
      {
        title: "ຫຼຸດສຽງລົບກວນ",
        text: "ກອງສຽງລົມ ສຽງຮຳ ແລະປັບສຽງເວົ້າໃຫ້ຊັດຂຶ້ນຕອນສົ່ງອອກວິດີໂອ",
      },
      {
        title: "ສະໄຕລ໌ຊັບພ້ອມໃຊ້",
        text: "Podcast ສອງແຖວ ໄຮໄລທ໌ຄຳ ແຖບສີ ແລະປ່ຽນສີເທື່ອລະຄຳໄດ້",
      },
      {
        title: "ອີໂມຈິ ແລະ Motion Graphic",
        text: "ອີໂມຈິເຄື່ອນໄຫວ ລູກສອນ ປຸ່ມ Follow ແລະສະຕິກເກີຂອງທ່ານເອງ",
      },
      {
        title: "B-roll ຟຣີໃນຄລິກດຽວ",
        text: "AI ແນະນຳຄຳຄົ້ນຫາ ແລ້ວເລືອກວິດີໂອແລະຮູບຟຣີໃສ່ໃນຊີນໄດ້ທັນທີ",
      },
      {
        title: "ແປຊັບຫຼາຍພາສາ",
        text: "ແປເປັນໄທ ລາວ ຫຼືອັງກິດໃນຄລິກດຽວ ເຂົ້າເຖິງຄົນເບິ່ງໄດ້ກວ້າງຂຶ້ນ",
      },
      {
        title: "ສົ່ງອອກເຖິງ 4K",
        text: "ເລືອກຄວາມລະອຽດແລະ FPS ພ້ອມຊັບຫຼືບໍ່ມີຊັບ ຫຼືສົ່ງຕໍ່ເຂົ້າ CapCut",
      },
    ],
  },
  how: {
    eyebrow: "ວິທີໃຊ້",
    title: "3 ຂັ້ນຕອນ ຄລິບພ້ອມໂພສ",
    steps: [
      { title: "ອັບໂຫຼດຄລິບ", text: "ເລືອກໄຟລ໌ຈາກມືຖືຫຼືຄອມ ຮອງຮັບ MP4 ແລະ MOV" },
      { title: "AI ໃສ່ຊັບໃຫ້", text: "ຖອດສຽງລາວ ແລະຈັດຈັງຫວະຄຳໃຫ້ອັດຕະໂນມັດ" },
      { title: "ແຕ່ງແລ້ວສົ່ງອອກ", text: "ເລືອກສະໄຕລ໌ ໃສ່ສະຕິກເກີແລະ B-roll ແລ້ວໂພສໄດ້ເລີຍ" },
    ],
  },
  pricing: {
    eyebrow: "ລາຄາ",
    title: "ເລີ່ມຟຣີ ຈ່າຍເມື່ອພ້ອມ",
    cycleLabel: "ຮອບການຊຳລະ",
    monthly: "ລາຍເດືອນ",
    yearly: "ລາຍປີ",
    twoMonthsFree: "ຟຣີ 2 ເດືອນ",
    trialLabel: "ທົດລອງໃຊ້",
    free: "ຟຣີ",
    trialNote: (days) => `${days} ມື້ · ບໍ່ຕ້ອງຜູກບັດ`,
    trialButton: "ເລີ່ມທົດລອງຟຣີ",
    trialPoints: (minutes) => [
      `AI ຖອດສຽງລວມ ${minutes}`,
      "ໃຊ້ໄດ້ທຸກຄຸນສົມບັດ",
      "ສົ່ງອອກວິດີໂອພ້ອມຊັບ",
    ],
    popular: "ຍອດນິຍົມ",
    useCode: "ໃຊ້ໂຄດ",
    perMonth: "ຕໍ່ເດືອນ",
    perYear: "ຕໍ່ປີ",
    proButton: (days) => `ທົດລອງຟຣີ ${days} ມື້ກ່ອນ`,
    proPoints: (minutes) => [
      `AI ຖອດສຽງ ${minutes} ຕໍ່ເດືອນ`,
      "ທຸກຄຸນສົມບັດ: ສະໄຕລ໌ ສະຕິກເກີ B-roll",
      "ສົ່ງອອກເຖິງ 4K ບໍ່ມີລາຍນ້ຳ",
      "ຊຳລະຜ່ານ QR ທະນາຄານ",
    ],
  },
  faqTitle: "ຄຳຖາມທີ່ພົບເລື້ອຍ",
  faq: [
    {
      q: "ທົດລອງໃຊ້ຟຣີຕ້ອງຜູກບັດບໍ?",
      a: "ບໍ່ຕ້ອງ ສະໝັກດ້ວຍອີເມວແລ້ວໃຊ້ໄດ້ທຸກຄຸນສົມບັດ 5 ມື້ ໝົດແລ້ວເລືອກໄດ້ວ່າຈະສະໝັກຕໍ່ຫຼືບໍ່",
    },
    {
      q: "ຊຳລະເງິນແນວໃດ?",
      a: "ສະແກນ QR ໂອນຜ່ານແອັບທະນາຄານ ແລ້ວອັບໂຫຼດສະລິບໃນໜ້າຊຳລະເງິນ ທີມງານກວດສອບແລ້ວເປີດສິດໃຫ້",
    },
    {
      q: "ຮອງຮັບພາສາຫຍັງແດ່?",
      a: "ຖອດສຽງພາສາລາວເປັນຫຼັກ ຮອງຮັບໄທແລະອັງກິດ ແລະແປຊັບເປັນພາສາອື່ນໄດ້ໃນຄລິກດຽວ",
    },
    {
      q: "ໃຊ້ໃນມືຖືໄດ້ບໍ?",
      a: "ໄດ້ ເປີດຜ່ານບຣາວເຊີໃນ iPhone ຫຼື Android ໄດ້ເລີຍ ບໍ່ຕ້ອງຕິດຕັ້ງແອັບ",
    },
    {
      q: "ນາທີຖອດສຽງແມ່ນຫຍັງ?",
      a: "ແມ່ນຄວາມຍາວສຽງທີ່ໃຫ້ AI ຖອດເປັນຊັບ ທົດລອງໃຊ້ໄດ້ 30 ນາທີ ແພັກເກດລາຍເດືອນແລະລາຍປີໄດ້ 300 ນາທີຕໍ່ເດືອນ",
    },
  ],
  cta: {
    title: "ພ້ອມເຮັດຄລິບໄວຣັລແລ້ວບໍ?",
    text: "ອັບໂຫຼດຄລິບທຳອິດມື້ນີ້ ໃຊ້ເວລາບໍ່ເຖິງ 5 ນາທີ ແລ້ວໂພສໄດ້ເລີຍ",
  },
  footer: {
    tagline: "ເຄື່ອງມື AI ໃສ່ຊັບລາວແລະຕັດຄລິບສັ້ນ ສຳລັບຄຣີເອເຕີ ຮ້ານຄ້າ ແລະແບຣນໃນລາວ",
    menu: "ເມນູ",
    account: "ບັນຊີ",
    emojiCredit: "ອີໂມຈິເຄື່ອນໄຫວ: Google Noto Emoji (CC BY 4.0)",
  },
};

const en: LandingCopy = {
  nav: { features: "Features", how: "How it works", pricing: "Pricing", faq: "FAQ" },
  navLabel: "Main menu",
  langLabel: "Language",
  login: "Log in",
  signup: "Sign up",
  billingLink: "Billing",
  openApp: "Open app",
  startFree: "Start free",
  tryFree: (days) => `Try free for ${days} days`,
  minutes: (n) => `${n.toLocaleString("en-US")} minutes`,
  hero: {
    badge: "AI subtitles for Lao content creators",
    line1: ["Lao ", "subtitles ", "for"],
    accent: "viral",
    tail: "clips with OneRun",
    subtitle:
      "Upload a clip and let AI turn Lao speech into word-by-word subtitles, then add styles, stickers and B-roll, ready for TikTok, Reels and Shorts.",
    howButton: "See how it works",
    note: "No card needed · Works in the browser on phone and computer",
  },
  features: {
    eyebrow: "Features",
    title: "Everything a short clip needs",
    subtitle: "No more switching apps. Subtitle, edit and export in one place.",
    items: [
      {
        title: "Accurate Lao subtitles",
        text: "Several AI models work together to transcribe Lao into Lao script word by word, English words mixed in included.",
      },
      {
        title: "Noise reduction",
        text: "Filters out wind and hum and makes the voice clearer when you export.",
      },
      {
        title: "Ready-made caption styles",
        text: "Two-line podcast captions, word highlights, color bars, and a color for any word.",
      },
      {
        title: "Emoji and motion graphics",
        text: "Animated emoji, arrows, Follow buttons and your own stickers.",
      },
      {
        title: "Free B-roll in one click",
        text: "AI suggests search terms, then drop free videos and photos into any scene.",
      },
      {
        title: "Translate subtitles",
        text: "Translate to Thai, Lao or English in one click and reach a wider audience.",
      },
      {
        title: "Export up to 4K",
        text: "Choose resolution and FPS, with or without subtitles, or send it on to CapCut.",
      },
    ],
  },
  how: {
    eyebrow: "How it works",
    title: "3 steps to a clip ready to post",
    steps: [
      {
        title: "Upload a clip",
        text: "Pick a file from your phone or computer. MP4 and MOV work.",
      },
      {
        title: "AI adds subtitles",
        text: "Transcribes Lao and times every word for you.",
      },
      {
        title: "Style and export",
        text: "Pick a style, add stickers and B-roll, and post.",
      },
    ],
  },
  pricing: {
    eyebrow: "Pricing",
    title: "Start free, pay when ready",
    cycleLabel: "Billing cycle",
    monthly: "Monthly",
    yearly: "Yearly",
    twoMonthsFree: "2 months free",
    trialLabel: "Free trial",
    free: "Free",
    trialNote: (days) => `${days} days · No card needed`,
    trialButton: "Start free trial",
    trialPoints: (minutes) => [
      `${minutes} of AI transcription`,
      "Every feature included",
      "Export videos with subtitles",
    ],
    popular: "Popular",
    useCode: "with code",
    perMonth: "per month",
    perYear: "per year",
    proButton: (days) => `Try ${days} days free first`,
    proPoints: (minutes) => [
      `${minutes} of AI transcription per month`,
      "Every feature: styles, stickers, B-roll",
      "Export up to 4K, no watermark",
      "Pay by bank QR",
    ],
  },
  faqTitle: "Frequently asked questions",
  faq: [
    {
      q: "Do I need a card for the free trial?",
      a: "No. Sign up with your email and use every feature for 5 days. When it ends, you decide whether to subscribe.",
    },
    {
      q: "How do I pay?",
      a: "Scan the QR code to transfer from your banking app, then upload the slip on the billing page. Our team checks it and unlocks your plan.",
    },
    {
      q: "Which languages are supported?",
      a: "Lao transcription comes first, Thai and English are supported, and subtitles translate to other languages in one click.",
    },
    {
      q: "Does it work on my phone?",
      a: "Yes. Open it in the browser on iPhone or Android. There is nothing to install.",
    },
    {
      q: "What are transcription minutes?",
      a: "The length of audio AI turns into subtitles. The trial includes 30 minutes; monthly and yearly plans include 300 minutes per month.",
    },
  ],
  cta: {
    title: "Ready to make a viral clip?",
    text: "Upload your first clip today. It takes under 5 minutes, then post it.",
  },
  footer: {
    tagline:
      "AI tool for Lao subtitles and short-clip editing, for creators, shops and brands in Laos.",
    menu: "Menu",
    account: "Account",
    emojiCredit: "Animated emoji: Google Noto Emoji (CC BY 4.0)",
  },
};

export const LANDING_COPY: Record<Lang, LandingCopy> = { lo, th, en };
