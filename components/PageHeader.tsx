"use client";

import { usePageHeader } from "@/lib/PageHeaderContext";

export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  usePageHeader(title, subtitle);
  return null;
}