/**
 * Terms of use and privacy policy in Lao, Thai and English. Written from what
 * the service really does; keep all three in step when something changes.
 */
import type { Lang } from "./landing-i18n";

/** A list item: plain text, or [bold lead, rest]. */
export type LegalItem = string | [string, string];

export type LegalSection = {
  title: string;
  paragraphs?: string[];
  items?: LegalItem[];
  /** paragraphs after the list */
  after?: string[];
  /** shows the contact set on the admin page */
  contact?: boolean;
};

export type LegalDoc = { title: string; intro: string; sections: LegalSection[] };

export type LegalUi = {
  updated: string;
  home: string;
  terms: string;
  privacy: string;
  plans: string;
  contactAt: string;
  contactFallback: string;
};

export const LEGAL_UPDATED: Record<Lang, string> = {
  lo: "20 ຕຸລາ 2026",
  th: "20 ตุลาคม 2026",
  en: "20 October 2026",
};

export const LEGAL_UI: Record<Lang, LegalUi> = {
  lo: {
    updated: "ອັບເດດລ່າສຸດ",
    home: "ໜ້າຫຼັກ",
    terms: "ເງື່ອນໄຂການນຳໃຊ້",
    privacy: "ນະໂຍບາຍຄວາມເປັນສ່ວນຕົວ",
    plans: "ແພັກເກດ ແລະ ລາຄາ",
    contactAt: "ຕິດຕໍ່ພວກເຮົາໄດ້ທີ່",
    contactFallback: "ຊ່ອງທາງຕິດຕໍ່ທີ່ສະແດງຢູ່ໜ້າແພັກເກດ",
  },
  th: {
    updated: "ปรับปรุงล่าสุด",
    home: "หน้าแรก",
    terms: "เงื่อนไขการใช้งาน",
    privacy: "นโยบายความเป็นส่วนตัว",
    plans: "แพ็กเกจและราคา",
    contactAt: "ติดต่อเราได้ที่",
    contactFallback: "ช่องทางติดต่อที่แสดงในหน้าแพ็กเกจ",
  },
  en: {
    updated: "Last updated",
    home: "Home",
    terms: "Terms of use",
    privacy: "Privacy policy",
    plans: "Plans & pricing",
    contactAt: "Contact us at",
    contactFallback: "the contact shown on the Plans page",
  },
};

export const TERMS: Record<Lang, LegalDoc> = {
  th: {
    title: "เงื่อนไขการใช้งาน",
    intro:
      "เงื่อนไขนี้ใช้กับการใช้งานเว็บไซต์และบริการ OneRunAI (“บริการ”) ซึ่งให้บริการโดยทีมงาน OneRunAI (“เรา”) เมื่อคุณสมัครหรือใช้บริการ ถือว่าคุณได้อ่านและยอมรับเงื่อนไขนี้และนโยบายความเป็นส่วนตัวของเรา หากไม่ยอมรับ กรุณาอย่าใช้บริการ",
    sections: [
      {
        title: "บริการของเรา",
        paragraphs: [
          "OneRunAI เป็นเครื่องมือตัดต่อคลิปสั้นที่ใช้ AI ถอดเสียง (ภาษาลาว ไทย และอังกฤษ) เป็นซับไตเติล พร้อมเครื่องมือจัดสไตล์ข้อความ สติกเกอร์ B-roll เสียงเอฟเฟกต์ และส่งออกวิดีโอ",
          "ซับที่ได้จาก AI อาจไม่ถูกต้องทุกคำ คุณควรตรวจและแก้ไขก่อนเผยแพร่ และเป็นผู้รับผิดชอบต่อเนื้อหาที่เผยแพร่เอง",
        ],
      },
      {
        title: "บัญชีผู้ใช้",
        items: [
          "คุณต้องอายุ 13 ปีขึ้นไป หากอายุต่ำกว่า 18 ปี ต้องได้รับความยินยอมจากผู้ปกครอง",
          "ใช้อีเมลที่เป็นของคุณจริง และเก็บรหัสผ่านไว้เป็นความลับ",
          "หนึ่งบัญชีสำหรับหนึ่งคน ห้ามแบ่งบัญชีหรือขายต่อสิทธิ์การใช้งาน",
          "ห้ามสมัครหลายบัญชีเพื่อรับสิทธิ์ทดลองใช้ฟรีซ้ำ เราอาจระงับบัญชีที่พบว่าทำเช่นนั้น",
          "หากสงสัยว่าบัญชีถูกผู้อื่นใช้ กรุณาเปลี่ยนรหัสผ่านและแจ้งเราทันที",
        ],
      },
      {
        title: "ทดลองใช้ฟรีและแพ็กเกจ",
        items: [
          "ผู้สมัครใหม่ได้ทดลองใช้ฟรีตามระยะเวลาและโควตาการใช้ AI ที่แสดงในหน้าแพ็กเกจ",
          "แพ็กเกจรายเดือนและรายปีมีราคาและโควตาตามที่แสดงในหน้าแพ็กเกจ ณ วันที่ชำระเงิน โควตาที่ไม่ได้ใช้จะไม่ทบไปรอบถัดไป",
          "การชำระเงินทำโดยโอนเงินผ่าน QR หรือบัญชีธนาคาร แล้วส่งสลิปในระบบ แพ็กเกจจะเริ่มใช้งานได้หลังผู้ดูแลตรวจสอบยอดเงินแล้ว",
          "การส่งสลิปปลอม แก้ไขสลิป หรือใช้สลิปของผู้อื่น ถือเป็นการฉ้อโกง เราจะระงับบัญชีและอาจดำเนินการตามกฎหมาย",
          "โค้ดส่วนลดใช้ได้ตามเงื่อนไขของแต่ละโค้ด และไม่สามารถแลกเป็นเงินสดได้",
          "เราอาจปรับราคาในอนาคต โดยไม่กระทบแพ็กเกจที่ชำระแล้ว",
        ],
      },
      {
        title: "การคืนเงิน",
        paragraphs: [
          "เมื่อแพ็กเกจได้รับการอนุมัติแล้ว เราไม่คืนเงิน ยกเว้นกรณีที่บริการขัดข้องจากฝั่งเราจนใช้งานหลักไม่ได้ และเราแก้ไขไม่ได้ภายในเวลาที่เหมาะสม คุณสามารถแจ้งขอคืนเงินภายใน 7 วันนับจากวันที่แพ็กเกจเริ่มใช้งาน หากโอนเงินผิดยอดหรือโอนซ้ำ กรุณาติดต่อเราพร้อมหลักฐาน",
        ],
      },
      {
        title: "การใช้งานที่ไม่อนุญาต",
        paragraphs: ["ห้ามใช้บริการเพื่อ:"],
        items: [
          "สร้างหรือเผยแพร่เนื้อหาที่ผิดกฎหมาย หลอกลวง หมิ่นประมาท หรือยุยงความรุนแรง",
          "เนื้อหาทางเพศที่เกี่ยวข้องกับผู้เยาว์ หรือเนื้อหาที่ละเมิดความเป็นส่วนตัวของผู้อื่น",
          "ใช้คลิป เพลง หรือสื่อของผู้อื่นโดยไม่มีสิทธิ์ (ละเมิดลิขสิทธิ์)",
          "เจาะระบบ หลบเลี่ยงโควตาหรือระบบชำระเงิน ใช้บอทหรือสคริปต์ยิงคำขออัตโนมัติ หรือทำให้บริการทำงานหนักผิดปกติ",
          "คัดลอกหรือขายต่อบริการ หรือนำคลังเสียงและสื่อในระบบไปแจกจ่ายแยกต่างหาก",
        ],
      },
      {
        title: "เนื้อหาและสิทธิ์ในผลงาน",
        items: [
          "คลิปและผลงานที่คุณสร้างเป็นของคุณ คุณอนุญาตให้เราประมวลผลเท่าที่จำเป็นเพื่อให้บริการ เช่น ส่งเสียงไปถอดเป็นซับ",
          "คุณรับรองว่ามีสิทธิ์ในคลิปและสื่อที่นำมาใช้",
          "เสียงเอฟเฟกต์ในคลังเสียงใช้ได้ในวิดีโอที่สร้างด้วย OneRunAI สื่อจาก KLIPY และ Pixabay อยู่ภายใต้เงื่อนไขของผู้ให้บริการนั้น ๆ",
          "ชื่อ โลโก้ และซอฟต์แวร์ของ OneRunAI เป็นทรัพย์สินของเรา",
        ],
      },
      {
        title: "ความพร้อมของบริการ",
        paragraphs: [
          "เราพยายามให้บริการใช้งานได้ตลอดเวลา แต่อาจมีช่วงหยุดปรับปรุง หรือขัดข้องจากผู้ให้บริการภายนอก เช่น ผู้ให้บริการ AI หรือโฮสติ้ง เราอาจเพิ่ม เปลี่ยน หรือยกเลิกฟีเจอร์ได้ตามความเหมาะสม",
        ],
      },
      {
        title: "ข้อจำกัดความรับผิด",
        paragraphs: [
          "บริการให้ “ตามสภาพที่เป็น” เท่าที่กฎหมายอนุญาต เราไม่รับผิดต่อความเสียหายทางอ้อม การสูญเสียรายได้ หรือข้อมูลที่เกิดจากการใช้บริการ ความรับผิดรวมของเราไม่เกินจำนวนเงินที่คุณชำระให้เราในช่วง 3 เดือนก่อนเกิดเหตุ เราแนะนำให้คุณเก็บไฟล์ต้นฉบับและไฟล์ที่ส่งออกไว้เอง",
        ],
      },
      {
        title: "การระงับและยกเลิกบัญชี",
        paragraphs: [
          "เราอาจระงับหรือยกเลิกบัญชีที่ละเมิดเงื่อนไขนี้ โดยไม่คืนเงินในกรณีที่ละเมิดร้ายแรง คุณสามารถขอลบบัญชีได้ตลอดเวลาโดยติดต่อเรา",
        ],
      },
      {
        title: "กฎหมายที่ใช้บังคับ",
        paragraphs: ["เงื่อนไขนี้อยู่ภายใต้กฎหมายของสาธารณรัฐประชาธิปไตยประชาชนลาว"],
      },
      {
        title: "การเปลี่ยนแปลงเงื่อนไข",
        paragraphs: [
          "เราอาจปรับปรุงเงื่อนไขนี้เป็นครั้งคราว และจะแสดงวันที่ปรับปรุงล่าสุดไว้ด้านบน หากมีการเปลี่ยนแปลงสำคัญ เราจะแจ้งในเว็บไซต์หรือทางอีเมล การใช้บริการต่อหลังการเปลี่ยนแปลงถือว่ายอมรับเงื่อนไขใหม่",
        ],
      },
      { title: "ติดต่อเรา", contact: true },
    ],
  },
  lo: {
    title: "ເງື່ອນໄຂການນຳໃຊ້",
    intro:
      "ເງື່ອນໄຂນີ້ໃຊ້ກັບການນຳໃຊ້ເວັບໄຊ ແລະ ບໍລິການ OneRunAI (“ບໍລິການ”) ເຊິ່ງໃຫ້ບໍລິການໂດຍທີມງານ OneRunAI (“ພວກເຮົາ”). ເມື່ອທ່ານສະໝັກ ຫຼື ນຳໃຊ້ບໍລິການ ຖືວ່າທ່ານໄດ້ອ່ານ ແລະ ຍອມຮັບເງື່ອນໄຂນີ້ ແລະ ນະໂຍບາຍຄວາມເປັນສ່ວນຕົວຂອງພວກເຮົາແລ້ວ. ຖ້າບໍ່ຍອມຮັບ ກະລຸນາຢ່ານຳໃຊ້ບໍລິການ.",
    sections: [
      {
        title: "ບໍລິການຂອງພວກເຮົາ",
        paragraphs: [
          "OneRunAI ເປັນເຄື່ອງມືຕັດຕໍ່ຄລິບສັ້ນທີ່ໃຊ້ AI ຖອດສຽງ (ພາສາລາວ, ໄທ ແລະ ອັງກິດ) ເປັນຊັບໄຕເຕິ້ນ ພ້ອມເຄື່ອງມືຈັດສະໄຕລ໌ຂໍ້ຄວາມ, ສະຕິກເກີ, B-roll, ສຽງເອັບເຟັກ ແລະ ສົ່ງອອກວິດີໂອ.",
          "ຊັບທີ່ໄດ້ຈາກ AI ອາດບໍ່ຖືກຕ້ອງທຸກຄຳ ທ່ານຄວນກວດ ແລະ ແກ້ໄຂກ່ອນເຜີຍແຜ່ ແລະ ທ່ານເປັນຜູ້ຮັບຜິດຊອບຕໍ່ເນື້ອຫາທີ່ເຜີຍແຜ່ເອງ.",
        ],
      },
      {
        title: "ບັນຊີຜູ້ໃຊ້",
        items: [
          "ທ່ານຕ້ອງມີອາຍຸ 13 ປີຂຶ້ນໄປ ຖ້າອາຍຸຕ່ຳກວ່າ 18 ປີ ຕ້ອງໄດ້ຮັບການຍິນຍອມຈາກຜູ້ປົກຄອງ.",
          "ໃຊ້ອີເມວທີ່ເປັນຂອງທ່ານແທ້ ແລະ ເກັບລະຫັດຜ່ານໄວ້ເປັນຄວາມລັບ.",
          "ໜຶ່ງບັນຊີສຳລັບໜຶ່ງຄົນ ຫ້າມແບ່ງບັນຊີ ຫຼື ຂາຍຕໍ່ສິດການນຳໃຊ້.",
          "ຫ້າມສະໝັກຫຼາຍບັນຊີເພື່ອຮັບສິດທົດລອງໃຊ້ຟຣີຊ້ຳ ພວກເຮົາອາດລະງັບບັນຊີທີ່ພົບວ່າເຮັດແບບນັ້ນ.",
          "ຖ້າສົງໄສວ່າບັນຊີຖືກຄົນອື່ນໃຊ້ ກະລຸນາປ່ຽນລະຫັດຜ່ານ ແລະ ແຈ້ງພວກເຮົາທັນທີ.",
        ],
      },
      {
        title: "ທົດລອງໃຊ້ຟຣີ ແລະ ແພັກເກດ",
        items: [
          "ຜູ້ສະໝັກໃໝ່ໄດ້ທົດລອງໃຊ້ຟຣີຕາມໄລຍະເວລາ ແລະ ໂຄຕ້າການໃຊ້ AI ທີ່ສະແດງຢູ່ໜ້າແພັກເກດ.",
          "ແພັກເກດລາຍເດືອນ ແລະ ລາຍປີ ມີລາຄາ ແລະ ໂຄຕ້າຕາມທີ່ສະແດງຢູ່ໜ້າແພັກເກດ ໃນວັນທີ່ຊຳລະເງິນ. ໂຄຕ້າທີ່ບໍ່ໄດ້ໃຊ້ຈະບໍ່ຖືກສະສົມໄປຮອບຕໍ່ໄປ.",
          "ການຊຳລະເງິນເຮັດໂດຍໂອນເງິນຜ່ານ QR ຫຼື ບັນຊີທະນາຄານ ແລ້ວສົ່ງສະລິບໃນລະບົບ. ແພັກເກດຈະເລີ່ມໃຊ້ງານໄດ້ຫຼັງຈາກຜູ້ດູແລກວດສອບຍອດເງິນແລ້ວ.",
          "ການສົ່ງສະລິບປອມ, ແກ້ໄຂສະລິບ ຫຼື ໃຊ້ສະລິບຂອງຄົນອື່ນ ຖືເປັນການສໍ້ໂກງ ພວກເຮົາຈະລະງັບບັນຊີ ແລະ ອາດດຳເນີນຄະດີຕາມກົດໝາຍ.",
          "ລະຫັດສ່ວນຫຼຸດໃຊ້ໄດ້ຕາມເງື່ອນໄຂຂອງແຕ່ລະລະຫັດ ແລະ ບໍ່ສາມາດແລກເປັນເງິນສົດໄດ້.",
          "ພວກເຮົາອາດປັບລາຄາໃນອະນາຄົດ ໂດຍບໍ່ກະທົບແພັກເກດທີ່ຊຳລະແລ້ວ.",
        ],
      },
      {
        title: "ການຄືນເງິນ",
        paragraphs: [
          "ເມື່ອແພັກເກດໄດ້ຮັບການອະນຸມັດແລ້ວ ພວກເຮົາບໍ່ຄືນເງິນ ຍົກເວັ້ນກໍລະນີທີ່ບໍລິການຂັດຂ້ອງຈາກຝັ່ງພວກເຮົາ ຈົນໃຊ້ງານຫຼັກບໍ່ໄດ້ ແລະ ພວກເຮົາແກ້ໄຂບໍ່ໄດ້ພາຍໃນເວລາທີ່ເໝາະສົມ. ທ່ານສາມາດແຈ້ງຂໍຄືນເງິນພາຍໃນ 7 ວັນ ນັບແຕ່ວັນທີ່ແພັກເກດເລີ່ມໃຊ້ງານ. ຖ້າໂອນເງິນຜິດຍອດ ຫຼື ໂອນຊ້ຳ ກະລຸນາຕິດຕໍ່ພວກເຮົາພ້ອມຫຼັກຖານ.",
        ],
      },
      {
        title: "ການນຳໃຊ້ທີ່ບໍ່ອະນຸຍາດ",
        paragraphs: ["ຫ້າມນຳໃຊ້ບໍລິການເພື່ອ:"],
        items: [
          "ສ້າງ ຫຼື ເຜີຍແຜ່ເນື້ອຫາທີ່ຜິດກົດໝາຍ, ຫຼອກລວງ, ໝິ່ນປະໝາດ ຫຼື ຍຸຍົງໃຫ້ເກີດຄວາມຮຸນແຮງ.",
          "ເນື້ອຫາທາງເພດທີ່ກ່ຽວຂ້ອງກັບຜູ້ເຍົາ ຫຼື ເນື້ອຫາທີ່ລະເມີດຄວາມເປັນສ່ວນຕົວຂອງຄົນອື່ນ.",
          "ໃຊ້ຄລິບ, ເພງ ຫຼື ສື່ຂອງຄົນອື່ນໂດຍບໍ່ມີສິດ (ລະເມີດລິຂະສິດ).",
          "ເຈາະລະບົບ, ຫຼົບຫຼີກໂຄຕ້າ ຫຼື ລະບົບຊຳລະເງິນ, ໃຊ້ບອດ ຫຼື ສະຄຣິບສົ່ງຄຳຂໍອັດຕະໂນມັດ ຫຼື ເຮັດໃຫ້ບໍລິການເຮັດວຽກໜັກຜິດປົກກະຕິ.",
          "ສຳເນົາ ຫຼື ຂາຍຕໍ່ບໍລິການ ຫຼື ນຳຄັງສຽງ ແລະ ສື່ໃນລະບົບໄປແຈກຢາຍແຍກຕ່າງຫາກ.",
        ],
      },
      {
        title: "ເນື້ອຫາ ແລະ ສິດໃນຜົນງານ",
        items: [
          "ຄລິບ ແລະ ຜົນງານທີ່ທ່ານສ້າງເປັນຂອງທ່ານ. ທ່ານອະນຸຍາດໃຫ້ພວກເຮົາປະມວນຜົນເທົ່າທີ່ຈຳເປັນເພື່ອໃຫ້ບໍລິການ ເຊັ່ນ ສົ່ງສຽງໄປຖອດເປັນຊັບ.",
          "ທ່ານຮັບຮອງວ່າມີສິດໃນຄລິບ ແລະ ສື່ທີ່ນຳມາໃຊ້.",
          "ສຽງເອັບເຟັກໃນຄັງສຽງໃຊ້ໄດ້ໃນວິດີໂອທີ່ສ້າງດ້ວຍ OneRunAI. ສື່ຈາກ KLIPY ແລະ Pixabay ຢູ່ພາຍໃຕ້ເງື່ອນໄຂຂອງຜູ້ໃຫ້ບໍລິການນັ້ນໆ.",
          "ຊື່, ໂລໂກ້ ແລະ ຊອບແວຂອງ OneRunAI ເປັນຊັບສິນຂອງພວກເຮົາ.",
        ],
      },
      {
        title: "ຄວາມພ້ອມຂອງບໍລິການ",
        paragraphs: [
          "ພວກເຮົາພະຍາຍາມໃຫ້ບໍລິການໃຊ້ງານໄດ້ຕະຫຼອດເວລາ ແຕ່ອາດມີຊ່ວງຢຸດປັບປຸງ ຫຼື ຂັດຂ້ອງຈາກຜູ້ໃຫ້ບໍລິການພາຍນອກ ເຊັ່ນ ຜູ້ໃຫ້ບໍລິການ AI ຫຼື ໂຮສຕິ້ງ. ພວກເຮົາອາດເພີ່ມ, ປ່ຽນ ຫຼື ຍົກເລີກຟີເຈີໄດ້ຕາມຄວາມເໝາະສົມ.",
        ],
      },
      {
        title: "ຂໍ້ຈຳກັດຄວາມຮັບຜິດຊອບ",
        paragraphs: [
          "ບໍລິການໃຫ້ “ຕາມສະພາບທີ່ເປັນຢູ່” ເທົ່າທີ່ກົດໝາຍອະນຸຍາດ. ພວກເຮົາບໍ່ຮັບຜິດຊອບຕໍ່ຄວາມເສຍຫາຍທາງອ້ອມ, ການສູນເສຍລາຍຮັບ ຫຼື ຂໍ້ມູນທີ່ເກີດຈາກການນຳໃຊ້ບໍລິການ. ຄວາມຮັບຜິດຊອບລວມຂອງພວກເຮົາບໍ່ເກີນຈຳນວນເງິນທີ່ທ່ານຊຳລະໃຫ້ພວກເຮົາໃນ 3 ເດືອນກ່ອນເກີດເຫດ. ພວກເຮົາແນະນຳໃຫ້ທ່ານເກັບໄຟລ໌ຕົ້ນສະບັບ ແລະ ໄຟລ໌ທີ່ສົ່ງອອກໄວ້ເອງ.",
        ],
      },
      {
        title: "ການລະງັບ ແລະ ຍົກເລີກບັນຊີ",
        paragraphs: [
          "ພວກເຮົາອາດລະງັບ ຫຼື ຍົກເລີກບັນຊີທີ່ລະເມີດເງື່ອນໄຂນີ້ ໂດຍບໍ່ຄືນເງິນໃນກໍລະນີທີ່ລະເມີດຮ້າຍແຮງ. ທ່ານສາມາດຂໍລຶບບັນຊີໄດ້ຕະຫຼອດເວລາໂດຍຕິດຕໍ່ພວກເຮົາ.",
        ],
      },
      {
        title: "ກົດໝາຍທີ່ນຳໃຊ້",
        paragraphs: ["ເງື່ອນໄຂນີ້ຢູ່ພາຍໃຕ້ກົດໝາຍຂອງ ສາທາລະນະລັດ ປະຊາທິປະໄຕ ປະຊາຊົນລາວ."],
      },
      {
        title: "ການປ່ຽນແປງເງື່ອນໄຂ",
        paragraphs: [
          "ພວກເຮົາອາດປັບປຸງເງື່ອນໄຂນີ້ເປັນບາງຄັ້ງ ແລະ ຈະສະແດງວັນທີອັບເດດລ່າສຸດໄວ້ດ້ານເທິງ. ຖ້າມີການປ່ຽນແປງສຳຄັນ ພວກເຮົາຈະແຈ້ງໃນເວັບໄຊ ຫຼື ທາງອີເມວ. ການນຳໃຊ້ບໍລິການຕໍ່ຫຼັງການປ່ຽນແປງ ຖືວ່າຍອມຮັບເງື່ອນໄຂໃໝ່.",
        ],
      },
      { title: "ຕິດຕໍ່ພວກເຮົາ", contact: true },
    ],
  },
  en: {
    title: "Terms of use",
    intro:
      "These terms apply to the OneRunAI website and service (the “Service”), provided by the OneRunAI team (“we”). By signing up for or using the Service, you confirm that you have read and accept these terms and our privacy policy. If you do not accept them, please do not use the Service.",
    sections: [
      {
        title: "Our service",
        paragraphs: [
          "OneRunAI is a short-video editor that uses AI to transcribe speech (Lao, Thai and English) into subtitles, with tools for text styles, stickers, B-roll, sound effects and video export.",
          "AI subtitles may not be correct word for word. Please check and edit them before publishing; you are responsible for the content you publish.",
        ],
      },
      {
        title: "Your account",
        items: [
          "You must be at least 13 years old. If you are under 18, you need a parent's or guardian's consent.",
          "Use an email address that is really yours and keep your password secret.",
          "One account per person. Do not share an account or resell access.",
          "Do not create several accounts to get the free trial again. We may suspend accounts found doing so.",
          "If you think someone else is using your account, change your password and tell us right away.",
        ],
      },
      {
        title: "Free trial and plans",
        items: [
          "New users get a free trial with the duration and AI quota shown on the Plans page.",
          "Monthly and yearly plans have the price and quota shown on the Plans page on the day you pay. Unused quota does not carry over.",
          "You pay by bank transfer or QR and upload the payment slip. A plan starts once an administrator has checked the payment.",
          "Sending a fake, edited or someone else's slip is fraud. We will suspend the account and may take legal action.",
          "Promo codes follow their own conditions and cannot be exchanged for cash.",
          "We may change prices in the future; plans already paid for are not affected.",
        ],
      },
      {
        title: "Refunds",
        paragraphs: [
          "Once a plan has been approved we do not give refunds, except when a fault on our side keeps the main features from working and we cannot fix it within a reasonable time. You can ask for a refund within 7 days of the plan starting. If you transferred a wrong amount or paid twice, contact us with proof.",
        ],
      },
      {
        title: "What you may not do",
        paragraphs: ["Do not use the Service to:"],
        items: [
          "Create or share content that is illegal, deceptive or defamatory, or that incites violence.",
          "Create sexual content involving minors, or content that violates other people's privacy.",
          "Use other people's clips, music or media without permission (copyright infringement).",
          "Break into the system, get around quotas or payments, send automated requests with bots or scripts, or put an abnormal load on the Service.",
          "Copy or resell the Service, or redistribute the sound library or other media from the Service on their own.",
        ],
      },
      {
        title: "Your content and rights",
        items: [
          "The clips and videos you make are yours. You allow us to process them as needed to provide the Service, for example sending audio to be transcribed.",
          "You confirm that you have the rights to the clips and media you use.",
          "Sound effects from the sound library may be used in videos made with OneRunAI. Media from KLIPY and Pixabay is subject to those providers' terms.",
          "The OneRunAI name, logo and software belong to us.",
        ],
      },
      {
        title: "Availability",
        paragraphs: [
          "We aim to keep the Service available at all times, but there may be maintenance or outages at outside providers such as AI or hosting providers. We may add, change or remove features.",
        ],
      },
      {
        title: "Limitation of liability",
        paragraphs: [
          "The Service is provided “as is” to the extent the law allows. We are not liable for indirect damages or for lost income or data arising from use of the Service. Our total liability is limited to the amount you paid us in the 3 months before the event. We recommend keeping your own copies of original and exported files.",
        ],
      },
      {
        title: "Suspension and closing accounts",
        paragraphs: [
          "We may suspend or close accounts that break these terms, without a refund in serious cases. You can ask us to delete your account at any time.",
        ],
      },
      {
        title: "Governing law",
        paragraphs: [
          "These terms are governed by the laws of the Lao People's Democratic Republic.",
        ],
      },
      {
        title: "Changes to these terms",
        paragraphs: [
          "We may update these terms from time to time; the date of the last update is shown at the top. We will announce important changes on the website or by email. Continuing to use the Service after a change means you accept the new terms.",
        ],
      },
      { title: "Contact us", contact: true },
    ],
  },
};

export const PRIVACY: Record<Lang, LegalDoc> = {
  th: {
    title: "นโยบายความเป็นส่วนตัว",
    intro:
      "นโยบายนี้อธิบายว่า OneRunAI (“เรา”) เก็บ ใช้ และดูแลข้อมูลของคุณอย่างไรเมื่อใช้บริการ เราเก็บข้อมูลเท่าที่จำเป็นต่อการให้บริการ และไม่ขายข้อมูลของคุณให้ใคร",
    sections: [
      {
        title: "ข้อมูลที่เราเก็บ",
        items: [
          ["ข้อมูลบัญชี:", "อีเมล และรหัสผ่าน (เก็บแบบเข้ารหัส เราไม่เห็นรหัสผ่านของคุณ)"],
          [
            "สถานะการใช้งาน:",
            "แพ็กเกจ วันหมดอายุ และบันทึกการใช้ AI (จำนวนวินาที ประเภทงาน และเวลา) เพื่อคำนวณโควตา",
          ],
          [
            "ข้อมูลการชำระเงิน:",
            "แพ็กเกจที่ซื้อ ยอดเงิน โค้ดส่วนลด และรูปสลิปที่คุณอัปโหลด เราไม่เก็บข้อมูลบัตรหรือรหัสผ่านธนาคาร",
          ],
          [
            "ผลการถอดเสียง:",
            "ข้อความซับที่ได้จาก AI เก็บไว้สูงสุด 30 วัน เพื่อไม่ต้องถอดเสียงเดิมซ้ำและไม่เสียโควตาซ้ำ",
          ],
          ["ไฟล์ที่คุณอัปโหลดเป็น B-roll:", "เก็บในพื้นที่ส่วนตัวของบัญชีคุณ"],
          [
            "ข้อมูลทางเทคนิค:",
            "เช่น IP และประเภทเบราว์เซอร์ ที่ระบบโฮสติ้งบันทึกตามปกติเพื่อความปลอดภัย",
          ],
        ],
      },
      {
        title: "ข้อมูลที่เราไม่เก็บ",
        items: [
          [
            "ไฟล์วิดีโอของคุณไม่ถูกอัปโหลดมาที่เรา:",
            "การตัดต่อ พรีวิว และการส่งออกวิดีโอทำในเบราว์เซอร์บนเครื่องของคุณ",
          ],
          "เฉพาะเสียงพูดบางช่วงจะถูกส่งไปถอดเป็นซับ และเราไม่เก็บไฟล์เสียงนั้นไว้ (เก็บเฉพาะข้อความผลลัพธ์ตามข้อ 1)",
          "งานที่บันทึกอัตโนมัติ (ซับ สไตล์ ตำแหน่งข้อความ) เก็บในเบราว์เซอร์ของเครื่องคุณเอง",
        ],
      },
      {
        title: "เราใช้ข้อมูลเพื่อ",
        items: [
          "ให้บริการ ถอดเสียง แปลซับ และคำนวณโควตา",
          "ตรวจสอบการชำระเงินและเปิดใช้งานแพ็กเกจ",
          "ส่งอีเมลที่จำเป็น เช่น ยืนยันอีเมล และตั้งรหัสผ่านใหม่",
          "ป้องกันการโกง การใช้งานผิดเงื่อนไข และรักษาความปลอดภัยของระบบ",
          "ดูสถิติการใช้งานภาพรวมเพื่อปรับปรุงบริการ",
        ],
      },
      {
        title: "ผู้ให้บริการภายนอกที่เราใช้",
        paragraphs: ["เราส่งข้อมูลให้ผู้ให้บริการต่อไปนี้เท่าที่จำเป็นต่อการทำงานของบริการ:"],
        items: [
          "Supabase: ฐานข้อมูล ระบบบัญชีผู้ใช้ และพื้นที่เก็บไฟล์",
          "Vercel: โฮสต์เว็บไซต์และเซิร์ฟเวอร์",
          "Google (Gemini) และ ElevenLabs: ถอดเสียง แปลซับ และลดเสียงรบกวน (ได้รับเฉพาะช่วงเสียงและข้อความที่ต้องประมวลผล)",
          "Resend: ส่งอีเมลยืนยันและอีเมลตั้งรหัสผ่าน",
          "KLIPY และ Pixabay: ค้นหาสื่อ GIF สติกเกอร์ และ B-roll (ได้รับคำค้นหาของคุณ)",
          "Cloudflare: จัดการโดเมนและเครือข่าย",
        ],
        after: [
          "ผู้ให้บริการเหล่านี้ประมวลผลข้อมูลตามนโยบายของตน บางรายอาจประมวลผลข้อมูลในต่างประเทศ",
        ],
      },
      {
        title: "ระยะเวลาเก็บข้อมูล",
        items: [
          "ข้อมูลบัญชีและสถานะการใช้งาน: เก็บตลอดที่บัญชียังเปิดอยู่",
          "ข้อมูลการชำระเงินและสลิป: เก็บไว้เป็นหลักฐานทางบัญชีตามที่กฎหมายกำหนด",
          "ผลการถอดเสียง: ไม่เกิน 30 วัน",
          "เมื่อลบบัญชี เราจะลบข้อมูลที่ไม่จำเป็นต้องเก็บตามกฎหมาย",
        ],
      },
      {
        title: "ความปลอดภัยของข้อมูล",
        paragraphs: [
          "การเชื่อมต่อทั้งหมดเข้ารหัสด้วย HTTPS ข้อมูลในฐานข้อมูลมีการจำกัดสิทธิ์ ผู้ใช้แต่ละคนเห็นเฉพาะข้อมูลของตัวเอง และมีเพียงผู้ดูแลระบบที่เข้าถึงสลิปการชำระเงินได้ แต่ไม่มีระบบใดปลอดภัย 100% หากพบปัญหาด้านความปลอดภัย กรุณาแจ้งเรา",
        ],
      },
      {
        title: "สิทธิ์ของคุณ",
        paragraphs: [
          "คุณขอดู แก้ไข หรือลบข้อมูลส่วนบุคคลของคุณ หรือขอลบบัญชีได้ โดยติดต่อเราจากอีเมลที่ใช้สมัคร เราจะดำเนินการภายในเวลาที่เหมาะสม",
        ],
      },
      {
        title: "ที่เก็บข้อมูลในเบราว์เซอร์ (คุกกี้)",
        paragraphs: [
          "เราใช้ที่เก็บข้อมูลในเบราว์เซอร์เพื่อจำการเข้าสู่ระบบ ภาษาที่เลือก และงานที่บันทึกอัตโนมัติ เราไม่ใช้คุกกี้โฆษณาหรือติดตามคุณข้ามเว็บไซต์",
        ],
      },
      {
        title: "การเปลี่ยนแปลงนโยบาย",
        paragraphs: [
          "เราอาจปรับปรุงนโยบายนี้และจะแสดงวันที่ปรับปรุงล่าสุดไว้ด้านบน หากมีการเปลี่ยนแปลงสำคัญ เราจะแจ้งในเว็บไซต์หรือทางอีเมล",
        ],
      },
      { title: "ติดต่อเรา", contact: true },
    ],
  },
  lo: {
    title: "ນະໂຍບາຍຄວາມເປັນສ່ວນຕົວ",
    intro:
      "ນະໂຍບາຍນີ້ອະທິບາຍວ່າ OneRunAI (“ພວກເຮົາ”) ເກັບ, ໃຊ້ ແລະ ດູແລຂໍ້ມູນຂອງທ່ານແນວໃດເມື່ອນຳໃຊ້ບໍລິການ. ພວກເຮົາເກັບຂໍ້ມູນເທົ່າທີ່ຈຳເປັນຕໍ່ການໃຫ້ບໍລິການ ແລະ ບໍ່ຂາຍຂໍ້ມູນຂອງທ່ານໃຫ້ໃຜ.",
    sections: [
      {
        title: "ຂໍ້ມູນທີ່ພວກເຮົາເກັບ",
        items: [
          [
            "ຂໍ້ມູນບັນຊີ:",
            "ອີເມວ ແລະ ລະຫັດຜ່ານ (ເກັບແບບເຂົ້າລະຫັດ ພວກເຮົາບໍ່ເຫັນລະຫັດຜ່ານຂອງທ່ານ).",
          ],
          [
            "ສະຖານະການນຳໃຊ້:",
            "ແພັກເກດ, ວັນໝົດອາຍຸ ແລະ ບັນທຶກການໃຊ້ AI (ຈຳນວນວິນາທີ, ປະເພດວຽກ ແລະ ເວລາ) ເພື່ອຄິດໄລ່ໂຄຕ້າ.",
          ],
          [
            "ຂໍ້ມູນການຊຳລະເງິນ:",
            "ແພັກເກດທີ່ຊື້, ຍອດເງິນ, ລະຫັດສ່ວນຫຼຸດ ແລະ ຮູບສະລິບທີ່ທ່ານອັບໂຫຼດ. ພວກເຮົາບໍ່ເກັບຂໍ້ມູນບັດ ຫຼື ລະຫັດຜ່ານທະນາຄານ.",
          ],
          [
            "ຜົນການຖອດສຽງ:",
            "ຂໍ້ຄວາມຊັບທີ່ໄດ້ຈາກ AI ເກັບໄວ້ສູງສຸດ 30 ວັນ ເພື່ອບໍ່ຕ້ອງຖອດສຽງເກົ່າຊ້ຳ ແລະ ບໍ່ເສຍໂຄຕ້າຊ້ຳ.",
          ],
          ["ໄຟລ໌ທີ່ທ່ານອັບໂຫຼດເປັນ B-roll:", "ເກັບໄວ້ໃນພື້ນທີ່ສ່ວນຕົວຂອງບັນຊີທ່ານ."],
          [
            "ຂໍ້ມູນທາງເຕັກນິກ:",
            "ເຊັ່ນ IP ແລະ ປະເພດບຣາວເຊີ ທີ່ລະບົບໂຮສຕິ້ງບັນທຶກຕາມປົກກະຕິເພື່ອຄວາມປອດໄພ.",
          ],
        ],
      },
      {
        title: "ຂໍ້ມູນທີ່ພວກເຮົາບໍ່ເກັບ",
        items: [
          [
            "ໄຟລ໌ວິດີໂອຂອງທ່ານບໍ່ຖືກອັບໂຫຼດມາຫາພວກເຮົາ:",
            "ການຕັດຕໍ່, ພຣີວິວ ແລະ ການສົ່ງອອກວິດີໂອ ເຮັດໃນບຣາວເຊີເທິງເຄື່ອງຂອງທ່ານ.",
          ],
          "ສະເພາະສຽງເວົ້າບາງຊ່ວງຈະຖືກສົ່ງໄປຖອດເປັນຊັບ ແລະ ພວກເຮົາບໍ່ເກັບໄຟລ໌ສຽງນັ້ນໄວ້ (ເກັບສະເພາະຂໍ້ຄວາມຜົນລັບຕາມຂໍ້ 1).",
          "ວຽກທີ່ບັນທຶກອັດຕະໂນມັດ (ຊັບ, ສະໄຕລ໌, ຕຳແໜ່ງຂໍ້ຄວາມ) ເກັບໄວ້ໃນບຣາວເຊີຂອງເຄື່ອງທ່ານເອງ.",
        ],
      },
      {
        title: "ພວກເຮົາໃຊ້ຂໍ້ມູນເພື່ອ",
        items: [
          "ໃຫ້ບໍລິການ, ຖອດສຽງ, ແປຊັບ ແລະ ຄິດໄລ່ໂຄຕ້າ.",
          "ກວດສອບການຊຳລະເງິນ ແລະ ເປີດໃຊ້ງານແພັກເກດ.",
          "ສົ່ງອີເມວທີ່ຈຳເປັນ ເຊັ່ນ ຢືນຢັນອີເມວ ແລະ ຕັ້ງລະຫັດຜ່ານໃໝ່.",
          "ປ້ອງກັນການສໍ້ໂກງ, ການນຳໃຊ້ຜິດເງື່ອນໄຂ ແລະ ຮັກສາຄວາມປອດໄພຂອງລະບົບ.",
          "ເບິ່ງສະຖິຕິການນຳໃຊ້ພາບລວມເພື່ອປັບປຸງບໍລິການ.",
        ],
      },
      {
        title: "ຜູ້ໃຫ້ບໍລິການພາຍນອກທີ່ພວກເຮົາໃຊ້",
        paragraphs: [
          "ພວກເຮົາສົ່ງຂໍ້ມູນໃຫ້ຜູ້ໃຫ້ບໍລິການຕໍ່ໄປນີ້ ເທົ່າທີ່ຈຳເປັນຕໍ່ການເຮັດວຽກຂອງບໍລິການ:",
        ],
        items: [
          "Supabase: ຖານຂໍ້ມູນ, ລະບົບບັນຊີຜູ້ໃຊ້ ແລະ ພື້ນທີ່ເກັບໄຟລ໌.",
          "Vercel: ໂຮສເວັບໄຊ ແລະ ເຊີບເວີ.",
          "Google (Gemini) ແລະ ElevenLabs: ຖອດສຽງ, ແປຊັບ ແລະ ຫຼຸດສຽງລົບກວນ (ໄດ້ຮັບສະເພາະຊ່ວງສຽງ ແລະ ຂໍ້ຄວາມທີ່ຕ້ອງປະມວນຜົນ).",
          "Resend: ສົ່ງອີເມວຢືນຢັນ ແລະ ອີເມວຕັ້ງລະຫັດຜ່ານ.",
          "KLIPY ແລະ Pixabay: ຄົ້ນຫາສື່ GIF, ສະຕິກເກີ ແລະ B-roll (ໄດ້ຮັບຄຳຄົ້ນຫາຂອງທ່ານ).",
          "Cloudflare: ຈັດການໂດເມນ ແລະ ເຄືອຂ່າຍ.",
        ],
        after: [
          "ຜູ້ໃຫ້ບໍລິການເຫຼົ່ານີ້ປະມວນຜົນຂໍ້ມູນຕາມນະໂຍບາຍຂອງຕົນ ບາງລາຍອາດປະມວນຜົນຂໍ້ມູນຢູ່ຕ່າງປະເທດ.",
        ],
      },
      {
        title: "ໄລຍະເວລາເກັບຂໍ້ມູນ",
        items: [
          "ຂໍ້ມູນບັນຊີ ແລະ ສະຖານະການນຳໃຊ້: ເກັບຕະຫຼອດທີ່ບັນຊີຍັງເປີດຢູ່.",
          "ຂໍ້ມູນການຊຳລະເງິນ ແລະ ສະລິບ: ເກັບໄວ້ເປັນຫຼັກຖານທາງບັນຊີຕາມທີ່ກົດໝາຍກຳນົດ.",
          "ຜົນການຖອດສຽງ: ບໍ່ເກີນ 30 ວັນ.",
          "ເມື່ອລຶບບັນຊີ ພວກເຮົາຈະລຶບຂໍ້ມູນທີ່ບໍ່ຈຳເປັນຕ້ອງເກັບຕາມກົດໝາຍ.",
        ],
      },
      {
        title: "ຄວາມປອດໄພຂອງຂໍ້ມູນ",
        paragraphs: [
          "ການເຊື່ອມຕໍ່ທັງໝົດເຂົ້າລະຫັດດ້ວຍ HTTPS. ຂໍ້ມູນໃນຖານຂໍ້ມູນມີການຈຳກັດສິດ ຜູ້ໃຊ້ແຕ່ລະຄົນເຫັນສະເພາະຂໍ້ມູນຂອງຕົນເອງ ແລະ ມີພຽງຜູ້ດູແລລະບົບທີ່ເຂົ້າເຖິງສະລິບການຊຳລະເງິນໄດ້. ແຕ່ບໍ່ມີລະບົບໃດປອດໄພ 100% ຖ້າພົບບັນຫາດ້ານຄວາມປອດໄພ ກະລຸນາແຈ້ງພວກເຮົາ.",
        ],
      },
      {
        title: "ສິດຂອງທ່ານ",
        paragraphs: [
          "ທ່ານສາມາດຂໍເບິ່ງ, ແກ້ໄຂ ຫຼື ລຶບຂໍ້ມູນສ່ວນບຸກຄົນຂອງທ່ານ ຫຼື ຂໍລຶບບັນຊີໄດ້ ໂດຍຕິດຕໍ່ພວກເຮົາຈາກອີເມວທີ່ໃຊ້ສະໝັກ. ພວກເຮົາຈະດຳເນີນການພາຍໃນເວລາທີ່ເໝາະສົມ.",
        ],
      },
      {
        title: "ບ່ອນເກັບຂໍ້ມູນໃນບຣາວເຊີ (ຄຸກກີ້)",
        paragraphs: [
          "ພວກເຮົາໃຊ້ບ່ອນເກັບຂໍ້ມູນໃນບຣາວເຊີເພື່ອຈື່ການເຂົ້າສູ່ລະບົບ, ພາສາທີ່ເລືອກ ແລະ ວຽກທີ່ບັນທຶກອັດຕະໂນມັດ. ພວກເຮົາບໍ່ໃຊ້ຄຸກກີ້ໂຄສະນາ ຫຼື ຕິດຕາມທ່ານຂ້າມເວັບໄຊ.",
        ],
      },
      {
        title: "ການປ່ຽນແປງນະໂຍບາຍ",
        paragraphs: [
          "ພວກເຮົາອາດປັບປຸງນະໂຍບາຍນີ້ ແລະ ຈະສະແດງວັນທີອັບເດດລ່າສຸດໄວ້ດ້ານເທິງ. ຖ້າມີການປ່ຽນແປງສຳຄັນ ພວກເຮົາຈະແຈ້ງໃນເວັບໄຊ ຫຼື ທາງອີເມວ.",
        ],
      },
      { title: "ຕິດຕໍ່ພວກເຮົາ", contact: true },
    ],
  },
  en: {
    title: "Privacy policy",
    intro:
      "This policy explains how OneRunAI (“we”) collects, uses and looks after your data when you use the Service. We collect only what the Service needs, and we do not sell your data to anyone.",
    sections: [
      {
        title: "What we collect",
        items: [
          [
            "Account details:",
            "your email and password (stored encrypted; we cannot see your password).",
          ],
          [
            "Usage status:",
            "your plan, expiry date and AI usage records (seconds, type of task and time) to work out your quota.",
          ],
          [
            "Payment details:",
            "the plan bought, amount, promo code and the slip image you upload. We do not store card numbers or bank passwords.",
          ],
          [
            "Transcription results:",
            "the subtitle text from the AI, kept for up to 30 days so the same audio is not transcribed (and charged) twice.",
          ],
          ["Files you upload as B-roll:", "stored in your account's private space."],
          [
            "Technical data:",
            "such as IP address and browser type, logged as usual by our hosting for security.",
          ],
        ],
      },
      {
        title: "What we do not collect",
        items: [
          [
            "Your video files are not uploaded to us:",
            "editing, preview and export all happen in the browser on your device.",
          ],
          "Only parts of the speech are sent to be transcribed, and we do not keep those audio files (only the resulting text, see section 1).",
          "Autosaved projects (subtitles, styles, text positions) are stored in your own browser.",
        ],
      },
      {
        title: "How we use your data",
        items: [
          "To provide the Service, transcribe and translate subtitles, and track quota.",
          "To check payments and activate plans.",
          "To send necessary emails, such as email confirmation and password reset.",
          "To prevent fraud and misuse and keep the system secure.",
          "To look at overall usage statistics and improve the Service.",
        ],
      },
      {
        title: "Service providers we use",
        paragraphs: [
          "We share data with the following providers only as far as the Service needs:",
        ],
        items: [
          "Supabase: database, user accounts and file storage.",
          "Vercel: website and server hosting.",
          "Google (Gemini) and ElevenLabs: transcription, translation and noise removal (they receive only the audio clips and text to process).",
          "Resend: confirmation and password reset emails.",
          "KLIPY and Pixabay: GIF, sticker and B-roll search (they receive your search terms).",
          "Cloudflare: domain and network.",
        ],
        after: [
          "These providers process data under their own policies; some may process data in other countries.",
        ],
      },
      {
        title: "How long we keep data",
        items: [
          "Account and usage data: for as long as the account is open.",
          "Payment records and slips: kept as accounting records as the law requires.",
          "Transcription results: up to 30 days.",
          "When an account is deleted, we delete the data we are not required by law to keep.",
        ],
      },
      {
        title: "Security",
        paragraphs: [
          "All connections are encrypted with HTTPS. Access to the database is restricted: each user sees only their own data, and only administrators can see payment slips. No system is 100% secure; if you find a security problem, please tell us.",
        ],
      },
      {
        title: "Your rights",
        paragraphs: [
          "You can ask to see, correct or delete your personal data, or to delete your account, by contacting us from the email you signed up with. We will act within a reasonable time.",
        ],
      },
      {
        title: "Browser storage (cookies)",
        paragraphs: [
          "We use browser storage to keep you signed in and to remember your language and autosaved work. We do not use advertising cookies or track you across websites.",
        ],
      },
      {
        title: "Changes to this policy",
        paragraphs: [
          "We may update this policy; the date of the last update is shown at the top. We will announce important changes on the website or by email.",
        ],
      },
      { title: "Contact us", contact: true },
    ],
  },
};
