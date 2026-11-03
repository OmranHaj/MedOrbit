import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { clearTour } from "@/hooks/use-tour";
import {
  useGetHandoverState,
  useGetHandoverSummary,
  useGetMyHandoverDoctors,
  useSwitchHandoverDemoView,
  useTransferRegion,
  getGetHandoverStateQueryKey,
  getGetHandoverSummaryQueryKey,
  getGetMyHandoverDoctorsQueryKey,
} from "@workspace/api-client-react";

const POLL = 30_000;

export function useHandoverState() {
  return useGetHandoverState({
    query: { queryKey: getGetHandoverStateQueryKey(), staleTime: 0, refetchInterval: POLL, refetchOnWindowFocus: true },
  });
}

export function useRegionSummary(region: string) {
  return useGetHandoverSummary(
    { region },
    {
      query: {
        queryKey: getGetHandoverSummaryQueryKey({ region }),
        enabled: !!region,
        staleTime: 0,
        refetchInterval: POLL,
        refetchOnWindowFocus: true,
      },
    },
  );
}

export function useMyDoctors(representativeId: number | null) {
  return useGetMyHandoverDoctors({
    query: { queryKey: [...getGetMyHandoverDoctorsQueryKey(), representativeId], staleTime: 0, enabled: representativeId !== null, refetchInterval: POLL, refetchOnWindowFocus: true },
  });
}

function isSummaryKey(k: readonly unknown[]) {
  return k[0] === getGetHandoverSummaryQueryKey()[0];
}

export function useHandoverInvalidate() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: getGetHandoverStateQueryKey() }),
      qc.invalidateQueries({ predicate: (q) => isSummaryKey(q.queryKey) }),
      qc.invalidateQueries({ queryKey: getGetMyHandoverDoctorsQueryKey() }),
    ]);
}

/** Switch the server-side demo view cookie. Cached data is only reset after the POST succeeds. */
export function useSwitchView() {
  const qc = useQueryClient();
  const [switching, setSwitching] = useState(false);
  const m = useSwitchHandoverDemoView();
  const switchTo = async (representativeId: number | null) => {
    setSwitching(true);
    try {
      await qc.cancelQueries();
      await m.mutateAsync({ data: { representativeId } });
      clearTour();
      // Reset active AND inactive observers; don't leave detached A observers showing A under B.
      await qc.resetQueries();
    } finally { setSwitching(false); }
  };
  return { switchTo, isPending: switching || m.isPending, error: m.error, reset: m.reset };
}

export function useTransfer() {
  const inv = useHandoverInvalidate();
  return useTransferRegion({ mutation: { onSettled: () => inv() } });
}
