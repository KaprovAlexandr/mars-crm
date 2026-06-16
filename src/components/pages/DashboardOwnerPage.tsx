import { MarsAppShellSidebar } from "@/components/layout/MarsAppShellSidebar";
import {
  buildOwnerDashboardSnapshot,
  formatRub,
  type OwnerChartBucket,
  type OwnerPeriodMode,
} from "@/lib/dashboard/ownerDashboardMetrics";
import { listJournalStorageRows } from "@/lib/data/journalDataSource";
import { listRequestsStorageRows } from "@/lib/data/requestsDataSource";
import { listWorkOrdersStorageRows } from "@/lib/data/workOrdersDataSource";
import { useEffect, useMemo, useRef, useState } from "react";

const PERIOD_LABELS: Record<OwnerPeriodMode, string> = {
  month: "Месяц",
  quarter: "Квартал",
  year: "Год",
};

function OwnerRevenueChart({
  buckets,
  maxRevenue,
  hoveredIndex,
  setHoveredIndex,
  selectedIndex,
  setSelectedIndex,
}: {
  buckets: OwnerChartBucket[];
  maxRevenue: number;
  hoveredIndex: number | null;
  setHoveredIndex: (i: number | null) => void;
  selectedIndex: number;
  setSelectedIndex: (i: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const n = buckets.length;
  const marginL = 52;
  const marginR = 24;
  const marginT = 28;
  const marginB = 40;
  const chartW = 900;
  const chartH = 210;
  const innerW = chartW - marginL - marginR;
  const innerH = chartH - marginT - marginB;
  const yMax = Math.max(1, maxRevenue * 1.08);
  const stepX = n <= 1 ? innerW / 2 : innerW / Math.max(1, n - 1);

  const points = useMemo(() => {
    return buckets.map((b, idx) => {
      const x = n <= 1 ? marginL + innerW / 2 : marginL + idx * stepX;
      const y = marginT + innerH - (b.revenue / yMax) * innerH;
      return { x, y, b, idx };
    });
  }, [buckets, innerH, marginL, marginT, n, stepX, yMax]);

  const polyPoints =
    n === 1 && points[0]
      ? `${points[0].x},${points[0].y} ${points[0].x + 0.5},${points[0].y}`
      : points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPoints =
    n > 0 && points[0]
      ? n === 1
        ? `${points[0].x - 20},${marginT + innerH} ${points[0].x},${points[0].y} ${points[0].x + 20},${marginT + innerH}`
        : `${marginL},${marginT + innerH} ${polyPoints} ${marginL + (n - 1) * stepX},${marginT + innerH}`
      : "";

  const gridLines = [0, 1, 2, 3, 4].map((i) => {
    const y = marginT + (i * innerH) / 4;
    const val = yMax - (i / 4) * yMax;
    return { y, val };
  });

  const focusIdx = hoveredIndex ?? selectedIndex;
  const focus = n > 0 && points.length > 0 ? points[Math.min(Math.max(0, focusIdx), n - 1)] : null;

  function pickIndexFromClientX(clientX: number): number | null {
    const el = svgRef.current;
    if (!el || n === 0) return null;
    const rect = el.getBoundingClientRect();
    const rx = ((clientX - rect.left) / rect.width) * 980;
    if (rx < marginL - 12 || rx > marginL + innerW + 12) return null;
    if (n === 1) return 0;
    const t = (rx - marginL) / innerW;
    const idx = Math.round(t * (n - 1));
    return Math.min(n - 1, Math.max(0, idx));
  }

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const idx = pickIndexFromClientX(e.clientX);
    setHoveredIndex(idx);
  };

  const onLeave = () => {
    setHoveredIndex(null);
  };

  const onClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const idx = pickIndexFromClientX(e.clientX);
    if (idx != null) setSelectedIndex(idx);
  };

  const fmtBucketTitle = (b: OwnerChartBucket) => {
    const a = b.start;
    const z = b.end;
    if (a.toDateString() === z.toDateString()) {
      return `${a.getDate().toString().padStart(2, "0")}.${(a.getMonth() + 1).toString().padStart(2, "0")}.${a.getFullYear()}`;
    }
    return `${a.getDate().toString().padStart(2, "0")}.${(a.getMonth() + 1).toString().padStart(2, "0")} — ${z.getDate().toString().padStart(2, "0")}.${(z.getMonth() + 1).toString().padStart(2, "0")}.${z.getFullYear()}`;
  };

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label="Выручка по заказ-нарядам"
      viewBox="0 0 980 280"
      className="h-full min-h-[220px] w-full cursor-crosshair touch-none"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={onClick}
    >
      <defs>
        <linearGradient id="ownerAreaDyn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E00919" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#E00919" stopOpacity="0.04" />
        </linearGradient>
      </defs>
      <g>
        {gridLines.map(({ y, val }) => (
          <g key={y}>
            <line x1={marginL} y1={y} x2={marginL + innerW} y2={y} stroke="#ECEDEF" />
            <text x="8" y={y + 4} className="fill-[#8C93A3] text-[11px]">
              {val >= 1e6 ? `${(val / 1e6).toFixed(1)}M` : val >= 1000 ? `${Math.round(val / 1000)}k` : Math.round(val)}
            </text>
          </g>
        ))}
      </g>

      {n > 0 && areaPoints ? (
        <>
          {focus ? (
            <>
              <rect
                x={focus.x - 18}
                y={marginT}
                width="36"
                height={innerH}
                fill="#E00919"
                opacity={hoveredIndex != null ? 0.12 : 0.06}
              />
              <polygon points={areaPoints} fill="url(#ownerAreaDyn)" />
              <polyline points={polyPoints} fill="none" stroke="#E00919" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={focus.x} cy={focus.y} r="5" fill="#E00919" stroke="white" strokeWidth="2" />
              <line x1={focus.x} y1={focus.y + 6} x2={focus.x} y2={marginT + innerH} stroke="#E00919" strokeDasharray="4 4" />
              <rect x={focus.x - 92} y={focus.y - 62} width="184" height="52" rx="8" fill="#2E2E33" />
              <text x={focus.x - 82} y={focus.y - 41} className="fill-white text-[11px]">
                {fmtBucketTitle(focus.b)}
              </text>
              <text x={focus.x - 82} y={focus.y - 22} className="fill-white text-[12px] font-semibold">
                {formatRub(focus.b.revenue)}
              </text>
            </>
          ) : null}
        </>
      ) : (
        <text x={400} y={150} className="fill-[#8C93A3] text-[14px]">
          Нет данных для графика
        </text>
      )}

      <g className="fill-[#8C93A3] text-[11px]">
        {points.map((p) => (
          <text key={p.idx} x={p.x} y={marginT + innerH + 28} textAnchor="middle">
            {p.b.label}
          </text>
        ))}
      </g>
    </svg>
  );
}

function ServiceDonut({ slices, centerTotal, centerLabel }: { slices: { label: string; count: number; percent: string; color: string }[]; centerTotal: number; centerLabel: string }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const total = slices.reduce((a, x) => a + x.count, 0) || 1;
  let offset = 0;
  const arcs = slices.map((s) => {
    const rawLen = (s.count / total) * c;
    const len = Math.min(c - 0.02, rawLen);
    const dash = `${len} ${c - len}`;
    const o = offset;
    offset -= len;
    return { ...s, dash, offset: o };
  });

  return (
    <div className="relative h-[210px] w-[210px]">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#EEF0F4" strokeWidth="6" />
        {arcs.map((a) => (
          <circle
            key={a.label}
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={a.color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={a.dash}
            strokeDashoffset={a.offset}
          />
        ))}
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-[34px] font-semibold leading-none text-[#222]">{centerTotal.toLocaleString("ru-RU")}</p>
          <p className="mt-1 text-[11px] text-[#9A9EA8]">{centerLabel}</p>
        </div>
      </div>
    </div>
  );
}

export function DashboardOwnerPage() {
  const [period, setPeriod] = useState<OwnerPeriodMode>("month");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workOrders, setWorkOrders] = useState<Awaited<ReturnType<typeof listWorkOrdersStorageRows>>>([]);
  const [journal, setJournal] = useState<Awaited<ReturnType<typeof listJournalStorageRows>>>([]);
  const [requests, setRequests] = useState<Awaited<ReturnType<typeof listRequestsStorageRows>>>([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const [wo, jn, rq] = await Promise.all([listWorkOrdersStorageRows(), listJournalStorageRows(), listRequestsStorageRows()]);
        if (!cancelled) {
          setWorkOrders(wo);
          setJournal(jn);
          setRequests(rq);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Не удалось загрузить данные");
          setWorkOrders([]);
          setJournal([]);
          setRequests([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const now = useMemo(() => new Date(), []);

  const snapshot = useMemo(
    () => buildOwnerDashboardSnapshot(period, now, workOrders, journal, requests),
    [period, now, workOrders, journal, requests],
  );

  useEffect(() => {
    const last = snapshot.buckets.length - 1;
    setSelectedIndex(last >= 0 ? last : 0);
    setHoveredIndex(null);
  }, [period, snapshot.buckets.length]);

  const serviceSlices = snapshot.serviceSlices.length
    ? snapshot.serviceSlices
    : [{ label: "Нет записей", count: 1, percent: "100%", color: "#D2D5DC" }];

  return (
    <div className="h-screen w-screen overflow-hidden bg-black max-lg:min-h-screen max-lg:h-auto max-lg:overflow-y-auto lg:h-screen lg:overflow-hidden">
      <div className="flex h-full w-full min-h-0 p-2 max-lg:h-auto lg:h-full">
        <div className="flex h-full min-h-0 w-full max-lg:h-auto max-lg:flex-col rounded-[16px] bg-black p-2 shadow-none lg:flex-row lg:shadow-[0_16px_30px_-20px_rgba(0,0,0,0.95)]">
          <MarsAppShellSidebar mobileLayout="requests" />

          <main className="flex min-h-0 min-w-0 flex-1 flex-col max-lg:overflow-x-hidden">
            <header className="mb-2 rounded-[16px] border border-[#DDE1E7] bg-white px-4 py-4 lg:px-5 lg:py-5">
              <div className="flex items-center max-lg:flex-col max-lg:items-stretch max-lg:gap-3 lg:flex-row">
                <h1 className="text-[28px] font-bold leading-[100%] tracking-[-0.04em] text-[#111826] lg:text-[36px]">Дашборд руководителя</h1>
                <button
                  type="button"
                  className="ml-auto h-12 rounded-[10px] bg-[#E00919] px-4 text-[16px] font-medium tracking-[-0.04em] text-white max-lg:ml-0 max-lg:w-full sm:max-lg:w-auto"
                >
                  Сформировать отчет
                </button>
              </div>
            </header>

            <section className="flex min-h-0 flex-1 flex-col gap-4 rounded-[16px] border border-[#DDE1E7] bg-white px-4 py-4 lg:px-5 lg:py-5">
              {error ? (
                <p className="rounded-[10px] border border-[#F5C6C6] bg-[#FFF5F5] px-4 py-3 text-[14px] text-[#B71C1C]">{error}</p>
              ) : null}
              {loading ? (
                <p className="text-[15px] text-[#6F7785]">Загрузка показателей…</p>
              ) : null}

              <div className="rounded-[10px] bg-[#F3F3F5] px-4 py-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {snapshot.kpis.map((kpi) => (
                    <article key={kpi.label} className="rounded-[12px] bg-white px-4 py-3">
                      <p className="text-[20px] font-medium tracking-[-0.04em] text-[#171717]">{kpi.label}</p>
                      <p className="mt-3 text-[38px] font-medium leading-none tracking-[-0.04em] text-[#E00919] lg:text-[52px]">{kpi.value}</p>
                      <p className="mt-2 text-[14px] font-medium text-[#8D8D95]">{kpi.delta}</p>
                    </article>
                  ))}
                </div>
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden xl:grid-cols-[50%_50%]">
                <article className="flex min-h-0 flex-col rounded-[10px] bg-[#F3F3F5] px-4 py-4">
                  <div className="mb-3 flex items-center justify-between max-sm:flex-col max-sm:items-stretch max-sm:gap-2">
                    <h2 className="text-[20px] font-semibold text-[#111]">Выручка по ЗН</h2>
                    <div className="flex items-center gap-2 max-sm:justify-end">
                      {(["month", "quarter", "year"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setPeriod(m)}
                          className={`rounded-[8px] px-3 py-1 text-[12px] font-medium transition-colors ${
                            period === m ? "bg-[#d51a21] text-white" : "bg-white text-[#444] hover:bg-[#ECEEF2]"
                          }`}
                        >
                          {PERIOD_LABELS[m]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 overflow-x-auto rounded-[10px] bg-white p-3">
                    <OwnerRevenueChart
                      buckets={snapshot.buckets}
                      maxRevenue={snapshot.maxChartRevenue}
                      hoveredIndex={hoveredIndex}
                      setHoveredIndex={setHoveredIndex}
                      selectedIndex={selectedIndex}
                      setSelectedIndex={setSelectedIndex}
                    />
                  </div>
                </article>

                <article className="min-h-0 rounded-[10px] bg-[#F3F3F5] px-4 py-4">
                  <h2 className="mb-3 text-[20px] font-semibold text-[#111]">Типы работ (журнал)</h2>
                  <div className="flex h-[calc(100%-44px)] min-h-0 rounded-[10px] bg-white p-4 max-sm:flex-col max-sm:gap-3">
                    <div className="flex w-[46%] min-w-[260px] items-center justify-center max-sm:w-full max-sm:min-w-0">
                      <ServiceDonut slices={serviceSlices} centerTotal={snapshot.requestsTotal} centerLabel="Всего заявок" />
                    </div>
                    <div className="min-w-0 flex-1 pt-3 max-sm:w-full xl:flex xl:items-center xl:pt-0">
                      <div className="space-y-3">
                        {serviceSlices.map((row) => (
                          <div key={row.label} className="grid grid-cols-[10px_1fr_auto_auto] items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                            <span className="truncate text-[12px] text-[#4A4F59]">{row.label}</span>
                            <span className="text-[12px] text-[#8E949F]">{row.count}</span>
                            <span className="text-[12px] text-[#8E949F]">{row.percent}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
