import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "นโยบายความเป็นส่วนตัว — OneRunAI" },
      {
        name: "description",
        content: "OneRunAI privacy policy · ນະໂຍບາຍຄວາມເປັນສ່ວນຕົວ · นโยบายความเป็นส่วนตัว",
      },
    ],
  }),
  component: () => <LegalPage doc="privacy" />,
});
