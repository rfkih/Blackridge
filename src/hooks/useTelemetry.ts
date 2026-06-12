'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import {
  getHealth,
  getJvmTelemetry,
  type HealthStatus,
  type Jvm,
  type JvmTelemetrySnapshot,
} from '@/lib/api/actuator';

const JVMS: Jvm[] = ['trading', 'research'];

const TELEMETRY_POLL_MS = 15_000;
const HEALTH_POLL_MS = 30_000;
/** Number of frames to keep in the rolling sparkline buffer. 60 × 5s = 5 min. */
const FRAME_BUFFER_SIZE = 60;

export type ServiceHealthMap = Record<
  Jvm,
  {
    status: HealthStatus['status'] | 'UNREACHABLE';
    raw: HealthStatus | null;
    lastSeen: number | null;
    /** True iff this JVM has not responded since the hook mounted. */
    pending: boolean;
    /** True iff a background refetch is currently in flight (data still visible). */
    refreshing: boolean;
  }
>;

/**
 * Polls /actuator/health on both JVMs every 30s. UNREACHABLE means the
 * client request itself failed (network, 401/403, JVM down) — distinct from
 * a 200 with `status: DOWN`. Polling pauses when the tab is hidden.
 */
export function useServiceHealth(): ServiceHealthMap {
  const queries = useQueries({
    queries: JVMS.map((jvm) => ({
      queryKey: ['actuator', 'health', jvm],
      queryFn: () => getHealth(jvm),
      refetchInterval: HEALTH_POLL_MS,
      refetchIntervalInBackground: false,
      staleTime: HEALTH_POLL_MS / 2,
      retry: 0,
      placeholderData: (prev: HealthStatus | undefined) => prev,
    })),
  });

  const out = {} as ServiceHealthMap;
  JVMS.forEach((jvm, i) => {
    const q = queries[i];
    out[jvm] = {
      status: q.isError ? 'UNREACHABLE' : (q.data?.status ?? 'UNKNOWN'),
      raw: q.data ?? null,
      lastSeen: q.dataUpdatedAt || null,
      pending: q.isPending,
      refreshing: q.isFetching && !q.isPending,
    };
  });
  return out;
}

export interface TelemetryFrame extends JvmTelemetrySnapshot {
  jvm: Jvm;
}

export interface JvmTelemetryView {
  trading: {
    current: JvmTelemetrySnapshot | null;
    samples: JvmTelemetrySnapshot[];
    refreshing: boolean;
  };
  research: {
    current: JvmTelemetrySnapshot | null;
    samples: JvmTelemetrySnapshot[];
    refreshing: boolean;
  };
}

type SamplesMap = Record<Jvm, JvmTelemetrySnapshot[]>;

/**
 * Polls actuator metrics on both JVMs every 5s and keeps a rolling 60-frame
 * buffer per JVM for the sparkline. Frames are appended only when the fetch
 * actually succeeds, so a single failing tick won't punch a gap into the
 * buffer — the previous value lingers until fresh data arrives.
 *
 * Polling pauses while the tab is hidden (refetchIntervalInBackground=false)
 * and queries keep prior data via placeholderData so transient network blips
 * don't flicker the sparkline to empty.
 */
export function useJvmTelemetry(): JvmTelemetryView {
  const bufferRef = useRef<SamplesMap>({ trading: [], research: [] });
  const [snapshot, setSnapshot] = useState<SamplesMap>({ trading: [], research: [] });

  const queries = useQueries({
    queries: JVMS.map((jvm) => ({
      queryKey: ['actuator', 'telemetry', jvm],
      queryFn: () => getJvmTelemetry(jvm),
      refetchInterval: TELEMETRY_POLL_MS,
      refetchIntervalInBackground: false,
      staleTime: TELEMETRY_POLL_MS / 2,
      retry: 0,
      placeholderData: (prev: JvmTelemetrySnapshot | undefined) => prev,
    })),
  });

  const dataKey = queries.map((q) => q.dataUpdatedAt).join('|');

  useEffect(() => {
    let appended = false;
    JVMS.forEach((jvm, i) => {
      const data = queries[i].data;
      if (!data) return;
      const buf = bufferRef.current[jvm];
      const last = buf[buf.length - 1];

      if (last && last.takenAt === data.takenAt) return;
      buf.push(data);
      if (buf.length > FRAME_BUFFER_SIZE) buf.shift();
      appended = true;
    });
    if (appended) {
      setSnapshot({
        trading: [...bufferRef.current.trading],
        research: [...bufferRef.current.research],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey]);

  const current = {} as Record<Jvm, JvmTelemetrySnapshot | null>;
  const refreshing = {} as Record<Jvm, boolean>;
  JVMS.forEach((jvm, i) => {
    current[jvm] = queries[i].data ?? null;
    refreshing[jvm] = queries[i].isFetching && !queries[i].isPending;
  });

  return {
    trading: {
      current: current.trading,
      samples: snapshot.trading,
      refreshing: refreshing.trading,
    },
    research: {
      current: current.research,
      samples: snapshot.research,
      refreshing: refreshing.research,
    },
  };
}
