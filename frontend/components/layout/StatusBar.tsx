// frontend/components/layout/StatusBar.tsx

"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/hooks/useRedux";
import {
  selectAppName,
  selectAppVersion,
  selectBackend,
} from "@/features/system/systemSelectors";
import { checkBackendHealth } from "@/features/system/systemSlice";
import { STATUS_PRESENTATION } from "@/features/system/systemStatusPresentation";

export function StatusBar() {
  const dispatch = useAppDispatch();
  const appName = useAppSelector(selectAppName);
  const appVersion = useAppSelector(selectAppVersion);
  const backend = useAppSelector(selectBackend);
  const presentation = STATUS_PRESENTATION[backend.status];

  // StatusBar is the only component that shows backend health, so it is now
  // the single owner of the "ping on startup" action (SystemStatusCard was
  // retired when HelloGuideForge was removed).
  useEffect(() => {
    dispatch(checkBackendHealth());
  }, [dispatch]);

  return (
    <footer className="flex h-7 items-center justify-between border-t border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-400">
      <span>
        {appName} <span className="text-zinc-600">v{appVersion}</span>
      </span>
      <span className={`flex items-center gap-2 ${presentation.text}`}>
        backend {backend.address} — {presentation.label}
        <span className={`h-2 w-2 rounded-full ${presentation.dot}`} aria-hidden />
      </span>
    </footer>
  );
}