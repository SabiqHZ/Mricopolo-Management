"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type ReportRange = {
  date_from: string;
  date_to: string;
};

type Summary = {
  consignment: {
    sold_quantity: number;
    returned_quantity: number;
    revenue: number;
  };
  direct_order: {
    sold_quantity: number;
    revenue: number;
  };
  combined: {
    sold_quantity: number;
    revenue: number;
  };
};

type TopProduct = {
  rank: number;
  product_id: number;
  product_name: string;
  sold_quantity: number;
};

type TopStore = {
  rank: number;
  store_id: number;
  store_name: string;
  transaction_count: number;
  sold_quantity: number;
  returned_quantity: number;
  revenue: number;
};

type ReportResponse = {
  period: ReportRange;
  summary: Summary;
  top_products: TopProduct[];
  top_stores: TopStore[];
};

type PeriodMode = "daily" | "weekly" | "monthly" | "custom";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);

const formatNumber = (amount: number) => amount.toLocaleString("id-ID");

const toDateInputValue = (date: Date) => date.toISOString().slice(0, 10);

const startOfWeek = (date: Date) => {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  return result;
};

const getInitialRange = (): ReportRange => {
  const today = new Date();

  return {
    date_from: toDateInputValue(
      new Date(today.getFullYear(), today.getMonth(), today.getDate()),
    ),
    date_to: toDateInputValue(today),
  };
};

const getRangeForMode = (mode: PeriodMode): ReportRange => {
  const today = new Date();

  if (mode === "daily") {
    const value = toDateInputValue(today);

    return {
      date_from: value,
      date_to: value,
    };
  }

  if (mode === "weekly") {
    const monday = startOfWeek(today);

    return {
      date_from: toDateInputValue(monday),
      date_to: toDateInputValue(today),
    };
  }

  if (mode === "monthly") {
    return {
      date_from: toDateInputValue(
        new Date(today.getFullYear(), today.getMonth(), 1),
      ),
      date_to: toDateInputValue(today),
    };
  }

  return getInitialRange();
};

const MODE_LABEL: Record<PeriodMode, string> = {
  daily: "Harian",
  weekly: "Mingguan",
  monthly: "Bulanan",
  custom: "Kustom",
};

export default function ReportsPage() {
  const { token } = useAuth();

  const [mode, setMode] = useState<PeriodMode>("monthly");
  const [range, setRange] = useState<ReportRange>(() =>
    getRangeForMode("monthly"),
  );
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const periodLabel = useMemo(() => {
    if (!report) return "";

    return `${report.period.date_from} → ${report.period.date_to}`;
  }, [report]);

  const loadReport = async (nextRange: ReportRange) => {
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        date_from: nextRange.date_from,
        date_to: nextRange.date_to,
        limit: "10",
      });

      const data = (await apiFetch(
        `/reports?${params.toString()}`,
        {},
        token,
      )) as ReportResponse;

      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat laporan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;

    void loadReport(range);

    // Initial report is loaded when authentication becomes available.
    // Date changes are applied through the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleModeChange = (nextMode: PeriodMode) => {
    setMode(nextMode);

    if (nextMode === "custom") {
      return;
    }

    const nextRange = getRangeForMode(nextMode);
    setRange(nextRange);
    void loadReport(nextRange);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadReport(range);
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Laporan Penjualan</h1>
        <p className="mt-1 text-sm text-gray-600">
          Laporan gabungan untuk titip jual dan pesanan langsung.
        </p>
      </div>

      <div className="rounded-lg bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {(["daily", "weekly", "monthly", "custom"] as PeriodMode[]).map(
            (value) => (
              <button
                key={value}
                type="button"
                onClick={() => handleModeChange(value)}
                className={`rounded px-4 py-2 text-sm ${
                  mode === value
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {MODE_LABEL[value]}
              </button>
            ),
          )}
        </div>

        {mode === "custom" && (
          <form
            onSubmit={handleSubmit}
            className="mt-4 flex flex-wrap items-end gap-3 border-t pt-4"
          >
            <label className="grid gap-1 text-sm">
              Dari
              <input
                className="rounded border px-3 py-2"
                type="date"
                value={range.date_from}
                onChange={(event) =>
                  setRange({
                    ...range,
                    date_from: event.target.value,
                  })
                }
                required
              />
            </label>

            <label className="grid gap-1 text-sm">
              Sampai
              <input
                className="rounded border px-3 py-2"
                type="date"
                value={range.date_to}
                onChange={(event) =>
                  setRange({
                    ...range,
                    date_to: event.target.value,
                  })
                }
                required
              />
            </label>

            <button
              className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
              type="submit"
              disabled={loading}
            >
              {loading ? "Memuat..." : "Terapkan periode"}
            </button>
          </form>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {loading && !report && (
        <div className="rounded-lg bg-white p-5 shadow-sm">
          Memuat laporan...
        </div>
      )}

      {report && !error && (
        <>
          <div>
            <p className="text-sm text-gray-500">Periode laporan</p>
            <p className="mt-1 font-medium">{periodLabel}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Total terjual"
              value={formatNumber(report.summary.combined.sold_quantity)}
            />

            <MetricCard
              label="Total retur"
              value={formatNumber(report.summary.consignment.returned_quantity)}
            />

            <MetricCard
              label="Pendapatan gabungan"
              value={formatCurrency(report.summary.combined.revenue)}
            />

            <MetricCard
              label="Pendapatan pesanan langsung"
              value={formatCurrency(report.summary.direct_order.revenue)}
            />
          </div>

          <section className="rounded-lg bg-white p-5 shadow-sm">
            <h2 className="text-lg font-medium">Rincian pendapatan</h2>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <BreakdownCard
                label="Titip Jual"
                value={formatCurrency(report.summary.consignment.revenue)}
              />

              <BreakdownCard
                label="Pesanan Langsung"
                value={formatCurrency(report.summary.direct_order.revenue)}
              />

              <BreakdownCard
                label="Gabungan"
                value={formatCurrency(report.summary.combined.revenue)}
              />
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-2">
            <section className="rounded-lg bg-white shadow-sm">
              <div className="border-b p-5">
                <h2 className="text-lg font-medium">Produk Terlaris</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Diurutkan berdasarkan jumlah terjual.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="p-3">Peringkat</th>
                      <th className="p-3">Produk</th>
                      <th className="p-3">Terjual</th>
                    </tr>
                  </thead>

                  <tbody>
                    {report.top_products.length === 0 && (
                      <tr>
                        <td className="p-3 text-gray-500" colSpan={3}>
                          Tidak ada penjualan produk pada periode ini.
                        </td>
                      </tr>
                    )}

                    {report.top_products.map((product) => (
                      <tr key={product.product_id} className="border-t">
                        <td className="p-3">{product.rank}</td>
                        <td className="p-3 font-medium">
                          {product.product_name}
                        </td>
                        <td className="p-3">
                          {formatNumber(product.sold_quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-lg bg-white shadow-sm">
              <div className="border-b p-5">
                <h2 className="text-lg font-medium">Warung Terbaik</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Diurutkan berdasarkan pendapatan titip jual.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="p-3">Peringkat</th>
                      <th className="p-3">Warung</th>
                      <th className="p-3">Terjual</th>
                      <th className="p-3">Pendapatan</th>
                    </tr>
                  </thead>

                  <tbody>
                    {report.top_stores.length === 0 && (
                      <tr>
                        <td className="p-3 text-gray-500" colSpan={4}>
                          Tidak ada penjualan warung pada periode ini.
                        </td>
                      </tr>
                    )}

                    {report.top_stores.map((store) => (
                      <tr key={store.store_id} className="border-t">
                        <td className="p-3">{store.rank}</td>
                        <td className="p-3 font-medium">{store.store_name}</td>
                        <td className="p-3">
                          {formatNumber(store.sold_quantity)}
                        </td>
                        <td className="p-3">{formatCurrency(store.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-lg bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </article>
  );
}

function BreakdownCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}
