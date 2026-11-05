import { Suspense } from "react";
import { PageLoader } from "@/components/ui";
import { EditPasteView } from "./edit-view";

export default function EditPastePage() {
  return (
    <Suspense fallback={<PageLoader label="正在加载粘贴…" />}>
      <EditPasteView />
    </Suspense>
  );
}
