"use client";

import { CheckCircle2, Download, Smartphone, WifiOff } from "lucide-react";
import { useInstall } from "@/components/pwa";
import { Button } from "@/components/ui/button";
import { copy } from "@/copy";

const t = copy.pages.settings.install;

/** Install on the home screen, and whether offline works yet. */
export function InstallCard() {
  const install = useInstall();
  return (
    <div className="flex flex-col gap-3 text-sm">
      {install.installed ? (
        <p className="flex items-center gap-2 font-medium text-success">
          <CheckCircle2 aria-hidden className="size-4" />
          {t.installed}
        </p>
      ) : install.canPrompt ? (
        <div>
          <Button onClick={() => void install.prompt()}>
            <Download aria-hidden />
            {t.button}
          </Button>
        </div>
      ) : (
        <p className="flex items-start gap-2">
          <Smartphone aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          {install.ios ? t.ios : t.other}
        </p>
      )}
      <p className="flex items-center gap-2 text-muted-foreground" data-testid="offline-status">
        <WifiOff aria-hidden className="size-4" />
        {t.offline(install.offlineReady)}
      </p>
    </div>
  );
}
