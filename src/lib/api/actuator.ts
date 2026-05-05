// Frontend client for Spring Boot Actuator endpoints. Admin-only on both
// JVMs (gated in SecurityConfig). Powers the JVM telemetry + service-health
// panels on /research.
//
// V14 (2026-04-30): research JVM is internal-only and the trading JVM
// reverse-proxies its actuator at /research-actuator/**. We hit a single
// origin (the trading JVM) but use distinct path prefixes per JVM so the
// dashboard still shows two independent JVMs side-by-side.
import { apiClient } from './client';

export type Jvm = 'trading' | 'research';

export interface HealthStatus {
  status: 'UP' | 'DOWN' | 'OUT_OF_SERVICE' | 'UNKNOWN';
  components?: Record<string, { status: HealthStatus['status']; details?: unknown }>;
}

/** Single-value Actuator metric response (Spring Boot 3 shape). */
export interface MetricResponse {
  name: string;
  description?: string;
  baseUnit?: string;
  measurements: Array<{ statistic: string; value: number }>;
  availableTags: Array<{ tag: string; values: string[] }>;
}

// Trading JVM: native /actuator/**. Research JVM: forwarded by
// ResearchProxyController at /research-actuator/** → research:8081/actuator/**.
const ACTUATOR_PREFIX: Record<Jvm, string> = {
  trading: '/actuator',
  research: '/research-actuator',
};

export async function getHealth(jvm: Jvm): Promise<HealthStatus> {
  const { data } = await apiClient.get<HealthStatus>(`${ACTUATOR_PREFIX[jvm]}/health`);
  return data;
}

export async function getMetric(jvm: Jvm, name: string): Promise<MetricResponse> {
  const { data } = await apiClient.get<MetricResponse>(
    `${ACTUATOR_PREFIX[jvm]}/metrics/${name}`,
  );
  return data;
}

/**
 * Single-statistic helper. Most JVM metrics are scalar (`VALUE`) or have
 * a meaningful `MAX`/`COUNT`. Returns null when the statistic is absent so
 * the caller can render an em-dash instead of NaN.
 */
export function readStat(metric: MetricResponse, stat: string): number | null {
  const m = metric.measurements.find((x) => x.statistic === stat);
  return m ? m.value : null;
}

export interface JvmTelemetrySnapshot {
  /** Timestamp the snapshot was taken (client clock). */
  takenAt: number;
  heapUsedBytes: number | null;
  heapMaxBytes: number | null;
  nonHeapUsedBytes: number | null;
  /** GC pause p99 in seconds. */
  gcPauseP99Seconds: number | null;
  liveThreads: number | null;
  uptimeSeconds: number | null;
  /** [0..1] CPU fractions. */
  systemCpu: number | null;
  processCpu: number | null;
}

const HEAP_AREA_TAG = 'area:heap';
const NONHEAP_AREA_TAG = 'area:nonheap';

/**
 * Pull every metric we care about for one JVM in parallel and roll them
 * up into a single snapshot. Failed individual metrics fall back to null —
 * a partial snapshot is more useful than a hard failure when the dashboard
 * is the operator's only visibility.
 */
export async function getJvmTelemetry(jvm: Jvm): Promise<JvmTelemetrySnapshot> {
  const safe = async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn();
    } catch (err) {
      console.warn('[actuator] metric fetch failed:', err);
      return null;
    }
  };

  const prefix = ACTUATOR_PREFIX[jvm];
  const [
    heapUsed,
    heapMax,
    nonHeapUsed,
    gcPause,
    threads,
    uptime,
    sysCpu,
    procCpu,
  ] = await Promise.all([
    safe(() =>
      apiClient.get<MetricResponse>(`${prefix}/metrics/jvm.memory.used`, {
        params: { tag: HEAP_AREA_TAG },
      }).then((r) => r.data),
    ),
    safe(() =>
      apiClient.get<MetricResponse>(`${prefix}/metrics/jvm.memory.max`, {
        params: { tag: HEAP_AREA_TAG },
      }).then((r) => r.data),
    ),
    safe(() =>
      apiClient.get<MetricResponse>(`${prefix}/metrics/jvm.memory.used`, {
        params: { tag: NONHEAP_AREA_TAG },
      }).then((r) => r.data),
    ),
    safe(() => getMetric(jvm, 'jvm.gc.pause')),
    safe(() => getMetric(jvm, 'jvm.threads.live')),
    safe(() => getMetric(jvm, 'process.uptime')),
    safe(() => getMetric(jvm, 'system.cpu.usage')),
    safe(() => getMetric(jvm, 'process.cpu.usage')),
  ]);

  return {
    takenAt: Date.now(),
    heapUsedBytes: heapUsed ? readStat(heapUsed, 'VALUE') : null,
    heapMaxBytes: heapMax ? readStat(heapMax, 'VALUE') : null,
    nonHeapUsedBytes: nonHeapUsed ? readStat(nonHeapUsed, 'VALUE') : null,
    // Micrometer publishes percentile histograms when configured; the
    // statistic name carries the percentile (e.g. "0.99"). Fall back to
    // the MAX bucket if the percentile isn't published yet.
    gcPauseP99Seconds: gcPause
      ? readStat(gcPause, '0.99') ?? readStat(gcPause, 'MAX')
      : null,
    liveThreads: threads ? readStat(threads, 'VALUE') : null,
    uptimeSeconds: uptime ? readStat(uptime, 'VALUE') : null,
    systemCpu: sysCpu ? readStat(sysCpu, 'VALUE') : null,
    processCpu: procCpu ? readStat(procCpu, 'VALUE') : null,
  };
}
