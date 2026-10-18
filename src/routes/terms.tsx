import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "เงื่อนไขการใช้งาน — OneRunAI" },
      {
        name: "description",
        content: "OneRunAI terms of use · ເງື່ອນໄຂການນຳໃຊ້ · เงื่อนไขการใช้งาน",
      },
    ],
  }),
  component: () => <LegalPage doc="terms" />,
});
