"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type Store = {
  id: number;
  name: string;
  address: string | null;
  contact: string | null;
  visit_schedule: string | null;
  visit_reminder_days: number | null;
};

type StoreForm = {
  name: string;
  address: string;
  contact: string;
  visit_schedule: string;
  visit_reminder_days: string;
};

const emptyForm: StoreForm = {
  name: "",
  address: "",
  contact: "",
  visit_schedule: "",
  visit_reminder_days: "3",
};

export default function StoresPage() {
  const { token } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [form, setForm] = useState<StoreForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const refreshStores = async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      setStores(await fetchStores(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load stores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    let active = true;

    const loadInitialStores = async () => {
      try {
        const data = await fetchStores(token);
        if (active) setStores(data);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load stores");
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadInitialStores();
    return () => {
      active = false;
    };
  }, [token]);

  const updateField = (field: keyof StoreForm, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError("");
    const payload = {
      ...form,
      visit_reminder_days: Number(form.visit_reminder_days),
    };

    try {
      if (editingId) {
        await apiFetch(`/stores/${editingId}`, { method: "PUT", body: JSON.stringify(payload) }, token);
      } else {
        await apiFetch("/stores", { method: "POST", body: JSON.stringify(payload) }, token);
      }
      resetForm();
      await refreshStores();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save store");
    } finally {
      setSubmitting(false);
    }
  };

  const beginEdit = (store: Store) => {
    setEditingId(store.id);
    setForm({
      name: store.name,
      address: store.address ?? "",
      contact: store.contact ?? "",
      visit_schedule: store.visit_schedule ?? "",
      visit_reminder_days: String(store.visit_reminder_days ?? 3),
    });
    setError("");
  };

  const removeStore = async (store: Store) => {
    if (!token || !window.confirm(`Remove ${store.name}? Historical transactions will be kept.`)) return;
    setError("");
    try {
      await apiFetch(`/stores/${store.id}`, { method: "DELETE" }, token);
      if (editingId === store.id) resetForm();
      await refreshStores();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove store");
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Stores</h1>
        <p className="mt-1 text-sm text-gray-600">Manage consignment partners and visit reminders.</p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-3 rounded-lg bg-white p-5 shadow-sm md:grid-cols-2">
        <h2 className="md:col-span-2 text-lg font-medium">{editingId ? "Edit store" : "Add store"}</h2>
        <Field label="Name" value={form.name} onChange={(value) => updateField("name", value)} required />
        <Field label="Contact" value={form.contact} onChange={(value) => updateField("contact", value)} />
        <Field label="Address" value={form.address} onChange={(value) => updateField("address", value)} />
        <Field label="Visit schedule" value={form.visit_schedule} onChange={(value) => updateField("visit_schedule", value)} />
        <Field label="Reminder days" value={form.visit_reminder_days} onChange={(value) => updateField("visit_reminder_days", value)} type="number" min="1" required />
        <div className="flex items-end gap-2">
          <button className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50" type="submit" disabled={submitting}>
            {submitting ? "Saving..." : editingId ? "Save changes" : "Add store"}
          </button>
          {editingId && <button className="rounded border px-4 py-2" type="button" onClick={resetForm}>Cancel</button>}
        </div>
      </form>

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-100 text-gray-700">
            <tr><th className="p-3">Store</th><th className="p-3">Contact</th><th className="p-3">Schedule</th><th className="p-3">Reminder</th><th className="p-3">Actions</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td className="p-3" colSpan={5}>Loading stores...</td></tr>}
            {!loading && stores.length === 0 && <tr><td className="p-3" colSpan={5}>No stores yet.</td></tr>}
            {!loading && stores.map((store) => (
              <tr className="border-t" key={store.id}>
                <td className="p-3"><p className="font-medium">{store.name}</p>{store.address && <p className="mt-1 text-gray-600">{store.address}</p>}</td>
                <td className="p-3">{store.contact || "-"}</td>
                <td className="p-3">{store.visit_schedule || "-"}</td>
                <td className="p-3">{store.visit_reminder_days ?? 3} days</td>
                <td className="p-3 whitespace-nowrap"><button className="mr-3 text-blue-700" type="button" onClick={() => beginEdit(store)}>Edit</button><button className="text-red-700" type="button" onClick={() => void removeStore(store)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

async function fetchStores(token: string) {
  return apiFetch("/stores", {}, token) as Promise<Store[]>;
}

function Field({ label, value, onChange, type = "text", required = false, min }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; min?: string }) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      <input className="rounded border px-3 py-2" type={type} value={value} min={min} onChange={(event) => onChange(event.target.value)} required={required} />
    </label>
  );
}
