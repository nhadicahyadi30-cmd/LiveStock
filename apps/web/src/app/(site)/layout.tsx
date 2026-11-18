import type { ReactNode } from "react";
import { SiteFooter } from "@/components/mk/footer";
import { SiteHeader } from "@/components/mk/header";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (<><SiteHeader />{children}<SiteFooter /></>);
}
