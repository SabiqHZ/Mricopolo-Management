"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type Store = { id: number; name: string };
type Product = { id: number; name: string; base_price: string | number };
type PriceOverride = {
  product_id: number;
  product_name: string;
  base_price: string | number;
  price: string | number;
};

const formatCurrency = (amount: string | number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(amount));

export default function PricesPage() {
  const { token } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [overrides, setOverrides] = useState<PriceOverride[]>([]);
  const [storeId, setStoreId] = useState("");
  const [productId, setProductId] = useState("");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadOverrides = async (nextStoreId: string) => {
    if (!token || !nextStoreId) {
      setOverrides([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setOverrides(await fetchOverrides(nextStoreId, token));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal memuat harga khusus",
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
        const [nextStores, nextProducts] = await Promise.all([
          fetchStores(token),
          fetchProducts(token),
        ]);
        if (active) {
          setStores(nextStores);
          setProducts(nextProducts);
        }
      } catch (err) {
        if (active)
          setError(
            err instanceof Error
              ? err.message
              : "Gagal memuat data warung dan produk",
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

  const selectStore = (nextStoreId: string) => {
    setStoreId(nextStoreId);
    setProductId("");
    setPrice("");
    void loadOverrides(nextStoreId);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !storeId || !productId) return;
    setSubmitting(true);
    setError("");
    try {
      await apiFetch(
        "/prices",
        {
          method: "POST",
          body: JSON.stringify({
            store_id: Number(storeId),
            product_id: Number(productId),
            price: Number(price),
          }),
        },
        token,
      );
      setProductId("");
      setPrice("");
      await loadOverrides(storeId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal menyimpan harga khusus",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const editOverride = (override: PriceOverride) => {
    setProductId(String(override.product_id));
    setPrice(String(override.price));
    setError("");
  };

  const removeOverride = async (override: PriceOverride) => {
    if (
      !token ||
      !storeId ||
      !window.confirm(
        `Hapus harga khusus untuk ${override.product_name}? Harga dasar akan berlaku kembali.`,
      )
    )
      return;
    setError("");
    try {
      await apiFetch(
        `/prices/store/${storeId}/product/${override.product_id}`,
        { method: "DELETE" },
        token,
      );
      if (productId === String(override.product_id)) {
        setProductId("");
        setPrice("");
      }
      await loadOverrides(storeId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal menghapus harga khusus",
      );
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Harga khusus warung</h1>
        <p className="mt-1 text-sm text-gray-600">
          Atur harga khusus untuk sebuah produk di satu warung. Jika tidak,
          harga dasar akan berlaku.
        </p>
      </div>

      <label className="grid max-w-md gap-1 text-sm">
        Warung
        <select
          className="rounded border px-3 py-2"
          value={storeId}
          onChange={(event) => selectStore(event.target.value)}
        >
          <option value="">Pilih warung</option>
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </select>
      </label>

      {storeId && (
        <form
          onSubmit={handleSubmit}
          className="grid gap-3 rounded-lg bg-white p-5 shadow-sm md:grid-cols-2"
        >
          <h2 className="md:col-span-2 text-lg font-medium">
            Atur harga khusus
          </h2>
          <label className="grid gap-1 text-sm">
            Produk
            <select
              className="rounded border px-3 py-2"
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              required
            >
              <option value="">Pilih produk</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({formatCurrency(product.base_price)})
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Harga khusus
            <input
              className="rounded border px-3 py-2"
              type="number"
              min="0"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              required
            />
          </label>
          <button
            className="w-fit rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Menyimpan..." : "Simpan harga khusus"}
          </button>
        </form>
      )}

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {storeId && (
        <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="p-3">Produk</th>
                <th className="p-3">Harga dasar</th>
                <th className="p-3">Harga khusus</th>
                <th className="p-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className="p-3" colSpan={4}>
                    Memuat harga khusus...
                  </td>
                </tr>
              )}
              {!loading && overrides.length === 0 && (
                <tr>
                  <td className="p-3" colSpan={4}>
                    Belum ada harga khusus untuk warung ini.
                  </td>
                </tr>
              )}
              {!loading &&
                overrides.map((override) => (
                  <tr className="border-t" key={override.product_id}>
                    <td className="p-3 font-medium">{override.product_name}</td>
                    <td className="p-3">
                      {formatCurrency(override.base_price)}
                    </td>
                    <td className="p-3">{formatCurrency(override.price)}</td>
                    <td className="p-3 whitespace-nowrap">
                      <button
                        className="mr-3 text-blue-700"
                        type="button"
                        onClick={() => editOverride(override)}
                      >
                        Ubah
                      </button>
                      <button
                        className="text-red-700"
                        type="button"
                        onClick={() => void removeOverride(override)}
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
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

async function fetchOverrides(storeId: string, token: string) {
  return apiFetch(`/prices/store/${storeId}`, {}, token) as Promise<
    PriceOverride[]
  >;
}
