"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type Store = { id: number; name: string };
type Invoice = { id: number; store_id: number; store_name: string; total_amount: string | number; paid_amount: string | number; outstanding_balance: string | number; status: "PAID" | "UNPAID"; created_at: string };
type Payment = { id: number; amount: string | number; payment_date: string };

const formatCurrency = (amount: string | number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(amount));
const formatDate = (value: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(value));
const today = () => new Date().toISOString().slice(0, 10);

export default function InvoicesPage() {
  const { token } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [storeId, setStoreId] = useState("");
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadInvoices = async (nextStoreId = storeId) => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      setInvoices(await fetchInvoices(nextStoreId, token));
      setSelected(null);
      setPayments([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load invoices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    let active = true;
    const loadInitialData = async () => {
      try {
        const [nextStores, nextInvoices] = await Promise.all([fetchStores(token), fetchInvoices("", token)]);
        if (active) {
          setStores(nextStores);
          setInvoices(nextInvoices);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load invoices");
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadInitialData();
    return () => { active = false; };
  }, [token]);

  const applyFilter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadInvoices();
  };

  const showDetail = async (invoiceId: number) => {
    if (!token) return;
    setDetailLoading(true);
    setError("");
    try {
      const [invoice, paymentHistory] = await Promise.all([
        apiFetch(`/invoices/${invoiceId}`, {}, token) as Promise<Invoice>,
        apiFetch(`/payments/invoice/${invoiceId}`, {}, token) as Promise<Payment[]>,
      ]);
      setSelected(invoice);
      setPayments(paymentHistory);
      setAmount("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load invoice detail");
    } finally {
      setDetailLoading(false);
    }
  };

  const recordPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !selected) return;
    setSubmitting(true);
    setError("");
    try {
      await apiFetch("/payments", { method: "POST", body: JSON.stringify({ invoice_id: selected.id, amount: Number(amount), payment_date: paymentDate }) }, token);
      await Promise.all([loadInvoices(), showDetail(selected.id)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to record payment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-6">
      <div><h1 className="text-2xl font-semibold">Invoices and payments</h1><p className="mt-1 text-sm text-gray-600">Monitor invoices by store and record partial or full payments.</p></div>
      <form onSubmit={applyFilter} className="flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow-sm"><label className="grid gap-1 text-sm">Store<select className="rounded border px-3 py-2" value={storeId} onChange={(event) => setStoreId(event.target.value)}><option value="">All stores</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label><button className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50" type="submit" disabled={loading}>{loading ? "Loading..." : "Apply filter"}</button></form>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <div className="overflow-x-auto rounded-lg bg-white shadow-sm"><table className="w-full text-left text-sm"><thead className="bg-gray-100 text-gray-700"><tr><th className="p-3">Invoice</th><th className="p-3">Store</th><th className="p-3">Total</th><th className="p-3">Paid</th><th className="p-3">Outstanding</th><th className="p-3">Status</th><th className="p-3">Action</th></tr></thead><tbody>
        {loading && <tr><td className="p-3" colSpan={7}>Loading invoices...</td></tr>}
        {!loading && invoices.length === 0 && <tr><td className="p-3" colSpan={7}>No invoices match this filter.</td></tr>}
        {!loading && invoices.map((invoice) => <tr className="border-t" key={invoice.id}><td className="p-3">#{invoice.id}</td><td className="p-3">{invoice.store_name}</td><td className="p-3">{formatCurrency(invoice.total_amount)}</td><td className="p-3">{formatCurrency(invoice.paid_amount)}</td><td className="p-3">{formatCurrency(invoice.outstanding_balance)}</td><td className="p-3">{invoice.status}</td><td className="p-3"><button className="text-blue-700" type="button" onClick={() => void showDetail(invoice.id)}>View</button></td></tr>)}
      </tbody></table></div>
      {detailLoading && <p className="text-sm">Loading invoice detail...</p>}
      {selected && !detailLoading && <section className="space-y-4 rounded-lg bg-white p-5 shadow-sm"><div><h2 className="text-lg font-medium">Invoice #{selected.id} · {selected.store_name}</h2><p className="mt-1 text-sm text-gray-600">Created {formatDate(selected.created_at)} · {selected.status}</p><p className="mt-2 text-sm">Total {formatCurrency(selected.total_amount)} · Paid {formatCurrency(selected.paid_amount)} · Outstanding {formatCurrency(selected.outstanding_balance)}</p></div>
        {selected.status === "UNPAID" && <form onSubmit={recordPayment} className="flex flex-wrap items-end gap-3 border-t pt-4"><label className="grid gap-1 text-sm">Payment amount<input className="rounded border px-3 py-2" type="number" min="1" max={Number(selected.outstanding_balance)} value={amount} onChange={(event) => setAmount(event.target.value)} required /></label><label className="grid gap-1 text-sm">Payment date<input className="rounded border px-3 py-2" type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} required /></label><button className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50" type="submit" disabled={submitting}>{submitting ? "Saving..." : "Record payment"}</button></form>}
        <div><h3 className="font-medium">Payment history</h3><ul className="mt-2 divide-y">{payments.length === 0 && <li className="py-2 text-sm text-gray-600">No payments recorded.</li>}{payments.map((payment) => <li className="flex justify-between py-2 text-sm" key={payment.id}><span>{formatDate(payment.payment_date)}</span><span>{formatCurrency(payment.amount)}</span></li>)}</ul></div>
      </section>}
    </section>
  );
}

async function fetchStores(token: string) { return apiFetch("/stores", {}, token) as Promise<Store[]>; }
async function fetchInvoices(storeId: string, token: string) { const suffix = storeId ? `?store_id=${encodeURIComponent(storeId)}` : ""; return apiFetch(`/invoices${suffix}`, {}, token) as Promise<Invoice[]>; }
