"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button, type ButtonProps } from "./ui";
import { cn } from "@/lib/utils";

export async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}

export function CopyButton({
  value,
  label = "复制",
  copiedLabel = "已复制",
  variant = "secondary",
  size = "sm",
  className,
  showLabel = true,
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  showLabel?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    const ok = await copyText(value);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <Button onClick={onCopy} variant={variant} size={size} className={cn(className)} aria-label={copied ? copiedLabel : label}>
      {copied ? <Check className="size-3.5 text-accent" /> : <Copy className="size-3.5" />}
      {showLabel ? <span>{copied ? copiedLabel : label}</span> : null}
    </Button>
  );
}
