import type { Metadata } from "next";
import { copy } from "@/copy";
import { BrandPreview } from "@/features/brand/brand-preview";

export const metadata: Metadata = {
  title: copy.brandPage.title,
};

export default function BrandPage() {
  return <BrandPreview />;
}
