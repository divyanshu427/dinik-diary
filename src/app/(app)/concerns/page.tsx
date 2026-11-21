import { permanentRedirect } from "next/navigation";

/** "Concerns" became part of Health (Build Phase 12): old links still work. */
export default function ConcernsPage() {
  permanentRedirect("/health");
}
