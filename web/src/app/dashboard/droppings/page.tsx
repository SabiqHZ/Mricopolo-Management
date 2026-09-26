"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type Store = { id: number; name: string };
type Product = { id: number; name: string };
type Dropping = { id: number; store_id: number; dropped_at: string };
type DroppingDetail = Dropping & {
  items: Array<{ id: number; product_name: string; quantity: number }>;
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export default function DroppingsPage() {
  const { token } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [droppings, setDroppings] = useState<Dropping[]>([]);
  const [storeId, setStoreId] = useState("");
  const [productId, setProductId] = useState("");
  const [selected, setSelected] = useState<DroppingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  const loadDroppings = async (
    filters = { store_id: storeId, product_id: productId },
  ) => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      setDroppings(await fetchDroppings(filters, token));
      setSelected(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal memuat riwayat dropping",
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
        const [nextStores, nextProducts, nextDroppings] = await Promise.all([
          fetchStores(token),
          fetchProducts(token),
          fetchDroppings({}, token),
        ]);
        if (active) {
          setStores(nextStores);
          setProducts(nextProducts);
          setDroppings(nextDroppings);
        }
      } catch (err) {
        if (active)
          setError(
            err instanceof Error
              ? err.message
              : "Gagal memuat riwayat dropping",
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

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadDroppings();
  };

  const showDetail = async (id: number) => {
    if (!token) return;
    setDetailLoading(true);
    setError("");
    try {
      setSelected(
        (await apiFetch(`/droppings/${id}`, {}, token)) as DroppingDetail,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal memuat detail dropping",
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
        <h1 className="text-2xl font-semibold">Riwayat Dropping</h1>
        <p className="mt-1 text-sm text-gray-600">
          Lihat riwayat pengiriman dropping dan jumlah produknya.
        </p>
      </div>

      <form
        onSubmit={applyFilters}
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
        <label className="grid gap-1 text-sm">
          Produk
          <select
            className="rounded border px-3 py-2"
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
          >
            <option value="">Semua produk</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
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
              <th className="p-3">Tanggal dropping</th>
              <th className="p-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="p-3" colSpan={4}>
                  Memuat dropping...
                </td>
              </tr>
            )}
            {!loading && droppings.length === 0 && (
              <tr>
                <td className="p-3" colSpan={4}>
                  Tidak ada dropping yang cocok dengan filter ini.
                </td>
              </tr>
            )}
            {!loading &&
              droppings.map((dropping) => (
                <tr className="border-t" key={dropping.id}>
                  <td className="p-3">#{dropping.id}</td>
                  <td className="p-3">{storeName(dropping.store_id)}</td>
                  <td className="p-3">{formatDateTime(dropping.dropped_at)}</td>
                  <td className="p-3">
                    <button
                      className="text-blue-700"
                      type="button"
                      onClick={() => void showDetail(dropping.id)}
                    >
                      Lihat item
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {detailLoading && <p className="text-sm">Memuat item dropping...</p>}
      {selected && !detailLoading && (
        <section className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-lg font-medium">Item Dropping #{selected.id}</h2>
          <p className="mt-1 text-sm text-gray-600">
            {storeName(selected.store_id)} ·{" "}
            {formatDateTime(selected.dropped_at)}
          </p>
          <ul className="mt-4 divide-y">
            {selected.items.map((item) => (
              <li className="flex justify-between py-2" key={item.id}>
                <span>{item.product_name}</span>
                <span>{item.quantity}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

async function fetchStores(token: string) {
  return apiFetch("/stores", {}, token) as Promise<Store[]>;
}
async function fetchProducts(token: string) {
  return apiFetch("/products", {}, token) as Promise<Product[]>;
}
async function fetchDroppings(
  filters: { store_id?: string; product_id?: string },
  token: string,
) {
  const params = new URLSearchParams();
  if (filters.store_id) params.set("store_id", filters.store_id);
  if (filters.product_id) params.set("product_id", filters.product_id);
  const suffix = params.size ? `?${params.toString()}` : "";
  return apiFetch(`/droppings${suffix}`, {}, token) as Promise<Dropping[]>;
}
