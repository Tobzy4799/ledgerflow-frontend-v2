"use client";

import { createContext, useContext, useEffect, useState } from "react";

type HeaderInfo = { title: string; subtitle: string };

const PageHeaderContext = createContext<{
  header: HeaderInfo;
  setHeader: (h: HeaderInfo) => void;
} | null>(null);

export function PageHeaderProvider({ children }: { children: React.ReactNode }) {
  const [header, setHeader] = useState<HeaderInfo>({ title: "", subtitle: "" });
  return (
    <PageHeaderContext.Provider value={{ header, setHeader }}>
      {children}
    </PageHeaderContext.Provider>
  );
}

/// Each page calls this once with its own title/subtitle — the actual fixed
/// header bar lives in AppLayout and reads from this context, so it's a real,
/// separate flex row that never scrolls, not a sticky element fighting parent
/// margins/padding.
export function usePageHeader(title: string, subtitle: string) {
  const ctx = useContext(PageHeaderContext);
  useEffect(() => {
    ctx?.setHeader({ title, subtitle });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, subtitle]);
}

export function useHeaderInfo() {
  const ctx = useContext(PageHeaderContext);
  return ctx?.header ?? { title: "", subtitle: "" };
}