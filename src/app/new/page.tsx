"use client";

import { useAuth } from "@/components/auth-provider";
import { PasteForm } from "@/components/paste-form";

export default function NewPastePage() {
  // Anyone may publish: no auth gate here, `user` only decides whether the
  // paste is attributed to an account.
  const { user } = useAuth();
  return <PasteForm mode="create" user={user} />;
}
