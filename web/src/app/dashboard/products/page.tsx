"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type Product = {
  id: number;
  name: string;
  category: string | null;
  base_price: string | number;
};

type ProductForm = {
  name: string;
  category: string;
  base_price: string;
};

const emptyForm: ProductForm = { name: "", category: "", base_price: "" };

const formatCurrency = (amount: string | number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(amount));

export default function ProductsPage() {
  const { token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const refreshProducts = async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      setProducts(await fetchProducts(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    let active = true;

    const loadInitialProducts = async () => {
      try {
        const data = await fetchProducts(token);
        if (active) setProducts(data);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load products");
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadInitialProducts();
    return () => {
      active = false;
    };
  }, [token]);

  const updateField = (field: keyof ProductForm, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError("");
    const payload = { ...form, base_price: Number(form.base_price) };

    try {
      if (editingId) {
        await apiFetch(`/products/${editingId}`, { method: "PUT", body: JSON.stringify(payload) }, token);
      } else {
        await apiFetch("/products", { method: "POST", body: JSON.stringify(payload) }, token);
      }
      resetForm();
      await refreshProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save product");
    } finally {
      setSubmitting(false);
    }
  };

  const beginEdit = (product: Product) => {
    setEditingId(product.id);
    setForm({ name: product.name, category: product.category ?? "", base_price: String(product.base_price) });
    setError("");
  };

  const removeProduct = async (product: Product) => {
    if (!token || !window.confirm(`Remove ${product.name}? Historical transactions will be kept.`)) return;
    setError("");
    try {
      await apiFetch(`/products/${product.id}`, { method: "DELETE" }, token);
      if (editingId === product.id) resetForm();
      await refreshProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove product");
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Products</h1>
        <p className="mt-1 text-sm text-gray-600">Manage the products available for consignment sales.</p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-3 rounded-lg bg-white p-5 shadow-sm md:grid-cols-2">
        <h2 className="md:col-span-2 text-lg font-medium">{editingId ? "Edit product" : "Add product"}</h2>
        <Field label="Name" value={form.name} onChange={(value) => updateField("name", value)} required />
        <Field label="Category" value={form.category} onChange={(value) => updateField("category", value)} />
        <Field label="Base price" value={form.base_price} onChange={(value) => updateField("base_price", value)} type="number" min="0" required />
        <div className="flex items-end gap-2">
          <button className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50" type="submit" disabled={submitting}>
            {submitting ? "Saving..." : editingId ? "Save changes" : "Add product"}
          </button>
          {editingId && <button className="rounded border px-4 py-2" type="button" onClick={resetForm}>Cancel</button>}
        </div>
      </form>

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-100 text-gray-700"><tr><th className="p-3">Product</th><th className="p-3">Category</th><th className="p-3">Base price</th><th className="p-3">Actions</th></tr></thead>
          <tbody>
            {loading && <tr><td className="p-3" colSpan={4}>Loading products...</td></tr>}
            {!loading && products.length === 0 && <tr><td className="p-3" colSpan={4}>No products yet.</td></tr>}
            {!loading && products.map((product) => (
              <tr className="border-t" key={product.id}>
                <td className="p-3 font-medium">{product.name}</td>
                <td className="p-3">{product.category || "-"}</td>
                <td className="p-3">{formatCurrency(product.base_price)}</td>
                <td className="p-3 whitespace-nowrap"><button className="mr-3 text-blue-700" type="button" onClick={() => beginEdit(product)}>Edit</button><button className="text-red-700" type="button" onClick={() => void removeProduct(product)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

async function fetchProducts(token: string) {
  return apiFetch("/products", {}, token) as Promise<Product[]>;
}

function Field({ label, value, onChange, type = "text", required = false, min }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; min?: string }) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      <input className="rounded border px-3 py-2" type={type} value={value} min={min} onChange={(event) => onChange(event.target.value)} required={required} />
    </label>
  );
}
