import { reconcileSegmentsWithWords, type Segment } from "./audio";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const total = (list: Segment[]) => list.reduce((n, s) => n + (s.end - s.start), 0);

// 1. ขอบช่วงถูกขยายให้คลุมคำจริง แต่ต้องไม่กลืนความเงียบเป็นก้อนเดียว
{
  const segs: Segment[] = [
    { start: 1.0, end: 2.0 },
    { start: 3.0, end: 3.4 },
    { start: 5.0, end: 5.4 },
  ];
  const words = [
    { start: 0.94, end: 1.4 },
    { start: 1.5, end: 2.06 },
    { start: 2.95, end: 3.45 },
    // เวลาที่มาจากการเดา คร่อมความเงียบยาว ๆ — ต้องไม่ถูกใช้สร้างช่วงใหม่
    { start: 3.5, end: 4.9 },
    { start: 5.02, end: 5.5 },
  ];
  const out = reconcileSegmentsWithWords(segs, words, { duration: 6 });
  assert(out.length === 3, `ต้องยังมี 3 ช่วง ได้ ${out.length}`);
  assert(out[0]!.start <= 0.94 && out[0]!.end >= 2.06, "ช่วงแรกต้องคลุมคำจริง");
  assert(total(out) < total(segs) + 0.8, "ห้ามขยายจนกลืนความเงียบ");
}

// 2. เพดานการขยาย (maxGrow) ต้องกันคำเวลาเพี้ยนไม่ให้ยืดขอบเกิน
{
  const out = reconcileSegmentsWithWords(
    [{ start: 2.0, end: 3.0 }],
    [{ start: 0.2, end: 2.9 }],
    { duration: 6 },
  );
  assert(out[0]!.start >= 1.88, `ขอบซ้ายไม่ควรถอยเกิน maxGrow ได้ ${out[0]!.start}`);
}

// 3. คำสั้นที่ energy gate พลาด แต่อยู่ติดช่วงพูด ต้องถูกเพิ่มกลับมา
{
  const out = reconcileSegmentsWithWords(
    [{ start: 1.0, end: 2.0 }],
    [{ start: 2.2, end: 2.45 }],
    { duration: 6 },
  );
  assert(out.some((s) => s.start <= 2.2 && s.end >= 2.45), "คำเบาที่อยู่ติดกันต้องถูกเก็บ");
}

// 4. คำที่ลอยอยู่กลางความเงียบไกล ๆ ต้องไม่กลายเป็นช่วงใหม่
{
  const out = reconcileSegmentsWithWords(
    [{ start: 1.0, end: 2.0 }],
    [{ start: 4.5, end: 4.8 }],
    { duration: 6 },
  );
  assert(out.length === 1, "คำที่อยู่ไกลต้องไม่ถูกเพิ่ม");
}

console.log("audio reconcile tests passed");
