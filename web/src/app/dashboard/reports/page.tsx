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

const formatNumber = (amount: number) =>
  amount.toLocaleString("id-ID");

const toDateInputValue = (date: Date) =>
  date.toISOString().slice(0, 10);

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

      const data = await apiFetch(
        `/reports?${params.toString()}`,
        {},
        token,
      ) as ReportResponse;

      setReport(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load report",
      );
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
        <h1 className="text-2xl font-semibold">
          Sales Reports
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Combined reporting for consignment and direct orders.
        </p>
      </div>

      <div className="rounded-lg bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {[
            { value: "daily", label: "Daily" },
            { value: "weekly", label: "Weekly" },
            { value: "monthly", label: "Monthly" },
            { value: "custom", label: "Custom" },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() =>
                handleModeChange(item.value as PeriodMode)
              }
              className={`rounded px-4 py-2 text-sm ${
                mode === item.value
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {mode === "custom" && (
          <form
            onSubmit={handleSubmit}
            className="mt-4 flex flex-wrap items-end gap-3 border-t pt-4"
          >
            <label className="grid gap-1 text-sm">
              From
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
              To
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
              {loading ? "Loading..." : "Apply period"}
            </button>
          </form>
        )}
      </div>

      {error && (
        <p
          className="text-sm text-red-600"
          role="alert"
        >
          {error}
        </p>
      )}

      {loading && !report && (
        <div className="rounded-lg bg-white p-5 shadow-sm">
          Loading report...
        </div>
      )}

      {report && !error && (
        <>
          <div>
            <p className="text-sm text-gray-500">
              Reporting period
            </p>
            <p className="mt-1 font-medium">
              {periodLabel}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Total sold"
              value={formatNumber(
                report.summary.combined.sold_quantity,
              )}
            />

            <MetricCard
              label="Total returned"
              value={formatNumber(
                report.summary.consignment.returned_quantity,
              )}
            />

            <MetricCard
              label="Combined revenue"
              value={formatCurrency(
                report.summary.combined.revenue,
              )}
            />

            <MetricCard
              label="Direct Order revenue"
              value={formatCurrency(
                report.summary.direct_order.revenue,
              )}
            />
          </div>

          <section className="rounded-lg bg-white p-5 shadow-sm">
            <h2 className="text-lg font-medium">
              Revenue breakdown
            </h2>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <BreakdownCard
                label="Consignment"
                value={formatCurrency(
                  report.summary.consignment.revenue,
                )}
              />

              <BreakdownCard
                label="Direct Orders"
                value={formatCurrency(
                  report.summary.direct_order.revenue,
                )}
              />

              <BreakdownCard
                label="Combined"
                value={formatCurrency(
                  report.summary.combined.revenue,
                )}
              />
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-2">
            <section className="rounded-lg bg-white shadow-sm">
              <div className="border-b p-5">
                <h2 className="text-lg font-medium">
                  Top Products
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Ranked by quantity sold.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="p-3">Rank</th>
                      <th className="p-3">Product</th>
                      <th className="p-3">Sold</th>
                    </tr>
                  </thead>

                  <tbody>
                    {report.top_products.length === 0 && (
                      <tr>
                        <td
                          className="p-3 text-gray-500"
                          colSpan={3}
                        >
                          No product sales in this period.
                        </td>
                      </tr>
                    )}

                    {report.top_products.map((product) => (
                      <tr
                        key={product.product_id}
                        className="border-t"
                      >
                        <td className="p-3">
                          {product.rank}
                        </td>
                        <td className="p-3 font-medium">
                          {product.product_name}
                        </td>
                        <td className="p-3">
                          {formatNumber(
                            product.sold_quantity,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-lg bg-white shadow-sm">
              <div className="border-b p-5">
                <h2 className="text-lg font-medium">
                  Top Stores
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Ranked by consignment revenue.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="p-3">Rank</th>
                      <th className="p-3">Store</th>
                      <th className="p-3">Sold</th>
                      <th className="p-3">Revenue</th>
                    </tr>
                  </thead>

                  <tbody>
                    {report.top_stores.length === 0 && (
                      <tr>
                        <td
                          className="p-3 text-gray-500"
                          colSpan={4}
                        >
                          No store sales in this period.
                        </td>
                      </tr>
                    )}

                    {report.top_stores.map((store) => (
                      <tr
                        key={store.store_id}
                        className="border-t"
                      >
                        <td className="p-3">
                          {store.rank}
                        </td>
                        <td className="p-3 font-medium">
                          {store.store_name}
                        </td>
                        <td className="p-3">
                          {formatNumber(
                            store.sold_quantity,
                          )}
                        </td>
                        <td className="p-3">
                          {formatCurrency(store.revenue)}
                        </td>
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

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-lg bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </article>
  );
}

function BreakdownCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="mt-2 text-xl font-semibold">
        {value}
      </p>
    </div>
  );
}
