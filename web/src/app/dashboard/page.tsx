"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type Overview = {
  sold_quantity: number;
  returned_quantity: number;
  revenue: number;
  transaction_channel: "CONSIGNMENT";
  date_from: string;
  date_to: string;
};

const toDateInputValue = (date: Date) => date.toISOString().slice(0, 10);

const getMonthRange = () => {
  const today = new Date();
  return {
    date_from: toDateInputValue(new Date(today.getFullYear(), today.getMonth(), 1)),
    date_to: toDateInputValue(today),
  };
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);

export default function OverviewPage() {
  const { token } = useAuth();
  const [range, setRange] = useState(getMonthRange);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let active = true;

    const loadInitialOverview = async () => {
      try {
        const data = await fetchOverview(range, token);
        if (active) setOverview(data);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load dashboard overview");
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadInitialOverview();
    return () => {
      active = false;
    };
    // The token changing is the only lifecycle trigger; date changes require form submission.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      setOverview(await fetchOverview(range, token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load dashboard overview");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="mt-1 text-sm text-gray-600">Consignment sales only. Direct orders will be added in Phase 10.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow-sm">
        <label className="grid gap-1 text-sm">
          From
          <input className="rounded border px-3 py-2" type="date" value={range.date_from} onChange={(event) => setRange({ ...range, date_from: event.target.value })} required />
        </label>
        <label className="grid gap-1 text-sm">
          To
          <input className="rounded border px-3 py-2" type="date" value={range.date_to} onChange={(event) => setRange({ ...range, date_to: event.target.value })} required />
        </label>
        <button className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50" type="submit" disabled={loading}>
          {loading ? "Loading..." : "Apply period"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      {overview && !error && (
        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard label="Products sold" value={overview.sold_quantity.toLocaleString("id-ID")} />
          <MetricCard label="Products returned" value={overview.returned_quantity.toLocaleString("id-ID")} />
          <MetricCard label="Consignment revenue" value={formatCurrency(overview.revenue)} />
        </div>
      )}
    </section>
  );
}

async function fetchOverview(range: { date_from: string; date_to: string }, token: string) {
  const params = new URLSearchParams(range);
  return apiFetch(`/dashboard/overview?${params.toString()}`, {}, token) as Promise<Overview>;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-lg bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </article>
  );
}
