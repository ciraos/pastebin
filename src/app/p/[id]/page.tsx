import { Suspense } from "react";
import { PageLoader } from "@/components/ui";
import { PasteView } from "./paste-view";

export default function PastePage() {
  return (
    <Suspense fallback={<PageLoader label="正在加载粘贴…" />}>
      <PasteView />
    </Suspense>
  );
}
