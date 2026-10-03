import { useEffect, useState, useSyncExternalStore } from "react";

import { loadingSnapshot, subscribeLoading } from "../../../../core/loading/loadingProgress";
import { LOADING_QUIPS } from "./loadingQuips";

const QUIP_MS = 2400;

export interface LoadingStatus {
  status: "loading" | "failed";
  label: string;
  percent: number;
  quip: string;
  message: string | null;
  retry: (() => void) | null;
}

export function useLoadingStatus(): LoadingStatus {
  const state = useSyncExternalStore(subscribeLoading, loadingSnapshot, loadingSnapshot);

  const [first] = useState(() => Math.floor(Date.now() / QUIP_MS) % LOADING_QUIPS.length);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), QUIP_MS);
    return () => clearInterval(id);
  }, []);

  return {
    status: state?.status ?? "loading",
    label: state?.label ?? "Initialisation…",
    percent: Math.round((state?.progress ?? 0) * 100),
    quip: LOADING_QUIPS[(first + tick) % LOADING_QUIPS.length] ?? "",
    message: state?.status === "failed" ? state.message : null,
    retry: state?.status === "failed" ? state.retry : null,
  };
}
