"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type Store = { id: number; name: string };
type Return = {
  id: number;
  store_id: number;
  returned_at: string;
  invoice_id: number;
  invoice_total: string | number;
  invoice_status: "PAID" | "UNPAID";
};
type ReturnDetail = Return & {
  items: Array<{
    id: number;
    product_name: string;
    dropped_quantity: number;
    quantity: number;
    sold_quantity: number;
  }>;
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
const formatCurrency = (amount: string | number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(amount));
const STATUS_LABEL: Record<"PAID" | "UNPAID", string> = {
  PAID: "Lunas",
  UNPAID: "Belum bayar",
};

export default function ReturnsPage() {
  const { token } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [returns, setReturns] = useState<Return[]>([]);
  const [storeId, setStoreId] = useState("");
  const [selected, setSelected] = useState<ReturnDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  const loadReturns = async (nextStoreId = storeId) => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      setReturns(await fetchReturns(nextStoreId, token));
      setSelected(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal memuat riwayat retur",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    let active = true;
    const loadInitialData = async () => {
      try {
        const [nextStores, nextReturns] = await Promise.all([
          fetchStores(token),
          fetchReturns("", token),
        ]);
        if (active) {
          setStores(nextStores);
          setReturns(nextReturns);
        }
      } catch (err) {
        if (active)
          setError(
            err instanceof Error ? err.message : "Gagal memuat riwayat retur",
          );
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadInitialData();
    return () => {
      active = false;
    };
  }, [token]);

  const applyFilter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadReturns();
  };

  const showDetail = async (id: number) => {
    if (!token) return;
    setDetailLoading(true);
    setError("");
    try {
      setSelected(
        (await apiFetch(`/returns/${id}`, {}, token)) as ReturnDetail,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal memuat detail retur",
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const storeName = (id: number) =>
    stores.find((store) => store.id === id)?.name ?? `Warung #${id}`;

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Riwayat Retur</h1>
        <p className="mt-1 text-sm text-gray-600">
          Lihat riwayat retur, jumlah terjual, dan faktur yang dibuat untuk
          setiap kunjungan.
        </p>
      </div>
      <form
        onSubmit={applyFilter}
        className="flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow-sm"
      >
        <label className="grid gap-1 text-sm">
          Warung
          <select
            className="rounded border px-3 py-2"
            value={storeId}
            onChange={(event) => setStoreId(event.target.value)}
          >
            <option value="">Semua warung</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
          type="submit"
          disabled={loading}
        >
          {loading ? "Memuat..." : "Terapkan filter"}
        </button>
      </form>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="p-3">ID</th>
              <th className="p-3">Warung</th>
              <th className="p-3">Tanggal retur</th>
              <th className="p-3">Faktur</th>
              <th className="p-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="p-3" colSpan={5}>
                  Memuat retur...
                </td>
              </tr>
            )}
            {!loading && returns.length === 0 && (
              <tr>
                <td className="p-3" colSpan={5}>
                  Tidak ada retur yang cocok dengan filter ini.
                </td>
              </tr>
            )}
            {!loading &&
              returns.map((item) => (
                <tr className="border-t" key={item.id}>
                  <td className="p-3">#{item.id}</td>
                  <td className="p-3">{storeName(item.store_id)}</td>
                  <td className="p-3">{formatDateTime(item.returned_at)}</td>
                  <td className="p-3">
                    {formatCurrency(item.invoice_total)} ·{" "}
                    {STATUS_LABEL[item.invoice_status]}
                  </td>
                  <td className="p-3">
                    <button
                      className="text-blue-700"
                      type="button"
                      onClick={() => void showDetail(item.id)}
                    >
                      Lihat item
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {detailLoading && <p className="text-sm">Memuat item retur...</p>}
      {selected && !detailLoading && (
        <section className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-lg font-medium">Item Retur #{selected.id}</h2>
          <p className="mt-1 text-sm text-gray-600">
            Faktur #{selected.invoice_id}:{" "}
            {formatCurrency(selected.invoice_total)} ·{" "}
            {STATUS_LABEL[selected.invoice_status]}
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2">Produk</th>
                  <th className="p-2">Dropping</th>
                  <th className="p-2">Retur</th>
                  <th className="p-2">Terjual</th>
                </tr>
              </thead>
              <tbody>
                {selected.items.map((item) => (
                  <tr className="border-t" key={item.id}>
                    <td className="p-2">{item.product_name}</td>
                    <td className="p-2">{item.dropped_quantity}</td>
                    <td className="p-2">{item.quantity}</td>
                    <td className="p-2">{item.sold_quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </section>
  );
}

async function fetchStores(token: string) {
  return apiFetch("/stores", {}, token) as Promise<Store[]>;
}
async function fetchReturns(storeId: string, token: string) {
  const suffix = storeId ? `?store_id=${encodeURIComponent(storeId)}` : "";
  return apiFetch(`/returns${suffix}`, {}, token) as Promise<Return[]>;
}
