import { AppShell } from "@/components/app-shell/app-shell";
import { DataProvider } from "@/components/data-provider";

/** Every screen inside the app gets the data hooks and the sidebar / bottom tab bar. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <DataProvider>
      <AppShell>{children}</AppShell>
    </DataProvider>
  );
}
