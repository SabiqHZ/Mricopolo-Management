"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type Store = { id: number; name: string };
type Product = { id: number; name: string; base_price: string | number };
type PriceOverride = { product_id: number; product_name: string; base_price: string | number; price: string | number };

const formatCurrency = (amount: string | number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(amount));

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
      setError(err instanceof Error ? err.message : "Unable to load special prices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    let active = true;

    const loadInitialData = async () => {
      try {
        const [nextStores, nextProducts] = await Promise.all([fetchStores(token), fetchProducts(token)]);
        if (active) {
          setStores(nextStores);
          setProducts(nextProducts);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load stores and products");
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
      await apiFetch("/prices", {
        method: "POST",
        body: JSON.stringify({ store_id: Number(storeId), product_id: Number(productId), price: Number(price) }),
      }, token);
      setProductId("");
      setPrice("");
      await loadOverrides(storeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save special price");
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
    if (!token || !storeId || !window.confirm(`Remove the special price for ${override.product_name}? The base price will apply again.`)) return;
    setError("");
    try {
      await apiFetch(`/prices/store/${storeId}/product/${override.product_id}`, { method: "DELETE" }, token);
      if (productId === String(override.product_id)) {
        setProductId("");
        setPrice("");
      }
      await loadOverrides(storeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove special price");
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Store-specific prices</h1>
        <p className="mt-1 text-sm text-gray-600">Set a price override for a product at one store. Otherwise, its base price applies.</p>
      </div>

      <label className="grid max-w-md gap-1 text-sm">
        Store
        <select className="rounded border px-3 py-2" value={storeId} onChange={(event) => selectStore(event.target.value)}>
          <option value="">Choose a store</option>
          {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
        </select>
      </label>

      {storeId && <form onSubmit={handleSubmit} className="grid gap-3 rounded-lg bg-white p-5 shadow-sm md:grid-cols-2">
        <h2 className="md:col-span-2 text-lg font-medium">Set special price</h2>
        <label className="grid gap-1 text-sm">Product
          <select className="rounded border px-3 py-2" value={productId} onChange={(event) => setProductId(event.target.value)} required>
            <option value="">Choose a product</option>
            {products.map((product) => <option key={product.id} value={product.id}>{product.name} ({formatCurrency(product.base_price)})</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">Special price
          <input className="rounded border px-3 py-2" type="number" min="0" value={price} onChange={(event) => setPrice(event.target.value)} required />
        </label>
        <button className="w-fit rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50" type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Save special price"}
        </button>
      </form>}

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      {storeId && <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-100 text-gray-700"><tr><th className="p-3">Product</th><th className="p-3">Base price</th><th className="p-3">Special price</th><th className="p-3">Actions</th></tr></thead>
          <tbody>
            {loading && <tr><td className="p-3" colSpan={4}>Loading special prices...</td></tr>}
            {!loading && overrides.length === 0 && <tr><td className="p-3" colSpan={4}>No special prices for this store.</td></tr>}
            {!loading && overrides.map((override) => <tr className="border-t" key={override.product_id}>
              <td className="p-3 font-medium">{override.product_name}</td><td className="p-3">{formatCurrency(override.base_price)}</td><td className="p-3">{formatCurrency(override.price)}</td>
              <td className="p-3 whitespace-nowrap"><button className="mr-3 text-blue-700" type="button" onClick={() => editOverride(override)}>Edit</button><button className="text-red-700" type="button" onClick={() => void removeOverride(override)}>Remove</button></td>
            </tr>)}
          </tbody>
        </table>
      </div>}
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
  return apiFetch(`/prices/store/${storeId}`, {}, token) as Promise<PriceOverride[]>;
}
