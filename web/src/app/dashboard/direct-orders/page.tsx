"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type Product = { id: number; name: string; base_price: string | number };
type Payment = { id: number; amount: string | number; payment_date: string };
type OrderItem = {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: string | number;
};
type DirectOrder = {
  id: number;
  customer_name: string;
  order_date: string;
  pickup_delivery_date: string | null;
  status: "processing" | "completed";
  payment_status: "UNPAID" | "DEPOSIT" | "PAID";
  total_amount: string | number;
  paid_amount: string | number;
  outstanding_balance: string | number;
  created_at: string;
};
type DirectOrderDetail = DirectOrder & {
  items: OrderItem[];
  payments: Payment[];
};
type ItemRow = { product_id: string; quantity: string };

const formatCurrency = (amount: string | number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(amount));
const formatDate = (value: string) =>
  new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
    new Date(value),
  );
const today = () => new Date().toISOString().slice(0, 10);

const PAYMENT_STATUS_LABEL: Record<DirectOrder["payment_status"], string> = {
  UNPAID: "Belum bayar",
  DEPOSIT: "DP",
  PAID: "Lunas",
};
const ORDER_STATUS_LABEL: Record<DirectOrder["status"], string> = {
  processing: "Diproses",
  completed: "Selesai",
};

const emptyItemRow = (): ItemRow => ({ product_id: "", quantity: "1" });

export default function DirectOrdersPage() {
  const { token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<DirectOrder[]>([]);
  const [selected, setSelected] = useState<DirectOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [itemRows, setItemRows] = useState<ItemRow[]>([emptyItemRow()]);
  const [creating, setCreating] = useState(false);

  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(today);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const loadOrders = async () => {
    if (!token) return;
    try {
      setOrders(await fetchOrders(token));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load direct orders",
      );
    }
  };

  useEffect(() => {
    if (!token) return;
    let active = true;
    const loadInitialData = async () => {
      setLoading(true);
      setError("");
      try {
        const [nextProducts, nextOrders] = await Promise.all([
          fetchProducts(token),
          fetchOrders(token),
        ]);
        if (active) {
          setProducts(nextProducts);
          setOrders(nextOrders);
        }
      } catch (err) {
        if (active)
          setError(
            err instanceof Error ? err.message : "Unable to load direct orders",
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

  const showDetail = async (orderId: number) => {
    if (!token) return;
    setDetailLoading(true);
    setError("");
    try {
      const order = (await apiFetch(
        `/direct-orders/${orderId}`,
        {},
        token,
      )) as DirectOrderDetail;
      setSelected(order);
      setAmount("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load order detail",
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const addItemRow = () => setItemRows((rows) => [...rows, emptyItemRow()]);
  const removeItemRow = (index: number) =>
    setItemRows((rows) => rows.filter((_, i) => i !== index));
  const updateItemRow = (index: number, field: keyof ItemRow, value: string) =>
    setItemRows((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );

  const resetForm = () => {
    setCustomerName("");
    setPickupDate("");
    setDepositAmount("");
    setItemRows([emptyItemRow()]);
  };

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    const items = itemRows
      .filter((row) => row.product_id && Number(row.quantity) > 0)
      .map((row) => ({
        product_id: Number(row.product_id),
        quantity: Number(row.quantity),
      }));
    if (!customerName.trim() || items.length === 0) {
      setError("Nama pemesan dan minimal satu item produk wajib diisi");
      return;
    }
    setCreating(true);
    setError("");
    try {
      await apiFetch(
        "/direct-orders",
        {
          method: "POST",
          body: JSON.stringify({
            customer_name: customerName.trim(),
            pickup_delivery_date: pickupDate || null,
            deposit_amount: depositAmount ? Number(depositAmount) : 0,
            items,
            client_id: crypto.randomUUID(),
          }),
        },
        token,
      );
      resetForm();
      setShowForm(false);
      await loadOrders();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create direct order",
      );
    } finally {
      setCreating(false);
    }
  };

  const recordPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !selected) return;
    setSubmittingPayment(true);
    setError("");
    try {
      await apiFetch(
        `/direct-orders/${selected.id}/payments`,
        {
          method: "POST",
          body: JSON.stringify({
            amount: Number(amount),
            payment_date: paymentDate,
          }),
        },
        token,
      );
      await Promise.all([loadOrders(), showDetail(selected.id)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to record payment");
    } finally {
      setSubmittingPayment(false);
    }
  };

  const changeStatus = async (nextStatus: DirectOrder["status"]) => {
    if (!token || !selected || nextStatus === selected.status) return;
    setUpdatingStatus(true);
    setError("");
    try {
      await apiFetch(
        `/direct-orders/${selected.id}/status`,
        { method: "PATCH", body: JSON.stringify({ status: nextStatus }) },
        token,
      );
      await Promise.all([loadOrders(), showDetail(selected.id)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Direct orders</h1>
          <p className="mt-1 text-sm text-gray-600">
            Catat pesanan langsung dari pelanggan perorangan, terpisah dari
            titip jual warung.
          </p>
        </div>
        <button
          className="rounded bg-blue-600 px-4 py-2 text-white"
          type="button"
          onClick={() => setShowForm((value) => !value)}
        >
          {showForm ? "Batal" : "Pesanan baru"}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={submitCreate}
          className="space-y-4 rounded-lg bg-white p-5 shadow-sm"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              Nama pemesan
              <input
                className="rounded border px-3 py-2"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                required
              />
            </label>
            <label className="grid gap-1 text-sm">
              Tanggal ambil/kirim
              <input
                className="rounded border px-3 py-2"
                type="date"
                value={pickupDate}
                onChange={(event) => setPickupDate(event.target.value)}
              />
            </label>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Item pesanan</p>
            {itemRows.map((row, index) => (
              <div className="flex flex-wrap items-end gap-3" key={index}>
                <label className="grid flex-1 gap-1 text-sm">
                  Produk
                  <select
                    className="rounded border px-3 py-2"
                    value={row.product_id}
                    onChange={(event) =>
                      updateItemRow(index, "product_id", event.target.value)
                    }
                    required
                  >
                    <option value="">Pilih produk</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} · {formatCurrency(product.base_price)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm">
                  Jumlah
                  <input
                    className="w-24 rounded border px-3 py-2"
                    type="number"
                    min="1"
                    value={row.quantity}
                    onChange={(event) =>
                      updateItemRow(index, "quantity", event.target.value)
                    }
                    required
                  />
                </label>
                {itemRows.length > 1 && (
                  <button
                    className="text-sm text-red-600"
                    type="button"
                    onClick={() => removeItemRow(index)}
                  >
                    Hapus
                  </button>
                )}
              </div>
            ))}
            <button
              className="text-sm text-blue-700"
              type="button"
              onClick={addItemRow}
            >
              + Tambah item
            </button>
          </div>

          <label className="grid max-w-xs gap-1 text-sm">
            Uang muka (opsional)
            <input
              className="rounded border px-3 py-2"
              type="number"
              min="0"
              value={depositAmount}
              onChange={(event) => setDepositAmount(event.target.value)}
            />
          </label>

          <button
            className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
            type="submit"
            disabled={creating}
          >
            {creating ? "Menyimpan..." : "Simpan pesanan"}
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="p-3">Order</th>
              <th className="p-3">Pemesan</th>
              <th className="p-3">Ambil/kirim</th>
              <th className="p-3">Total</th>
              <th className="p-3">Outstanding</th>
              <th className="p-3">Pembayaran</th>
              <th className="p-3">Status</th>
              <th className="p-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="p-3" colSpan={8}>
                  Memuat data...
                </td>
              </tr>
            )}
            {!loading && orders.length === 0 && (
              <tr>
                <td className="p-3" colSpan={8}>
                  Belum ada pesanan langsung.
                </td>
              </tr>
            )}
            {!loading &&
              orders.map((order) => (
                <tr className="border-t" key={order.id}>
                  <td className="p-3">#{order.id}</td>
                  <td className="p-3">{order.customer_name}</td>
                  <td className="p-3">
                    {order.pickup_delivery_date
                      ? formatDate(order.pickup_delivery_date)
                      : "-"}
                  </td>
                  <td className="p-3">{formatCurrency(order.total_amount)}</td>
                  <td className="p-3">
                    {formatCurrency(order.outstanding_balance)}
                  </td>
                  <td className="p-3">
                    {PAYMENT_STATUS_LABEL[order.payment_status]}
                  </td>
                  <td className="p-3">{ORDER_STATUS_LABEL[order.status]}</td>
                  <td className="p-3">
                    <button
                      className="text-blue-700"
                      type="button"
                      onClick={() => void showDetail(order.id)}
                    >
                      Lihat
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {detailLoading && <p className="text-sm">Memuat detail pesanan...</p>}

      {selected && !detailLoading && (
        <section className="space-y-4 rounded-lg bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium">
                Pesanan #{selected.id} · {selected.customer_name}
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Dibuat {formatDate(selected.created_at)}
                {selected.pickup_delivery_date && (
                  <>
                    {" "}
                    · Ambil/kirim {formatDate(selected.pickup_delivery_date)}
                  </>
                )}
                {" · "}
                {PAYMENT_STATUS_LABEL[selected.payment_status]}
              </p>
            </div>
            <label className="grid gap-1 text-sm">
              Status
              <select
                className="rounded border px-3 py-2"
                value={selected.status}
                disabled={updatingStatus}
                onChange={(event) =>
                  void changeStatus(event.target.value as DirectOrder["status"])
                }
              >
                <option value="processing">Diproses</option>
                <option value="completed">Selesai</option>
              </select>
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="p-2">Produk</th>
                  <th className="p-2">Jumlah</th>
                  <th className="p-2">Harga satuan</th>
                  <th className="p-2">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {selected.items.map((item) => (
                  <tr className="border-t" key={item.id}>
                    <td className="p-2">{item.product_name}</td>
                    <td className="p-2">{item.quantity}</td>
                    <td className="p-2">{formatCurrency(item.unit_price)}</td>
                    <td className="p-2">
                      {formatCurrency(
                        Number(item.quantity) * Number(item.unit_price),
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-sm">
            Total {formatCurrency(selected.total_amount)} · Dibayar{" "}
            {formatCurrency(selected.paid_amount)} · Sisa{" "}
            {formatCurrency(selected.outstanding_balance)}
          </p>

          {Number(selected.outstanding_balance) > 0 && (
            <form
              onSubmit={recordPayment}
              className="flex flex-wrap items-end gap-3 border-t pt-4"
            >
              <label className="grid gap-1 text-sm">
                Jumlah pembayaran
                <input
                  className="rounded border px-3 py-2"
                  type="number"
                  min="1"
                  max={Number(selected.outstanding_balance)}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  required
                />
              </label>
              <label className="grid gap-1 text-sm">
                Tanggal pembayaran
                <input
                  className="rounded border px-3 py-2"
                  type="date"
                  value={paymentDate}
                  onChange={(event) => setPaymentDate(event.target.value)}
                  required
                />
              </label>
              <button
                className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
                type="submit"
                disabled={submittingPayment}
              >
                {submittingPayment ? "Menyimpan..." : "Catat pembayaran"}
              </button>
            </form>
          )}

          <div>
            <h3 className="font-medium">Riwayat pembayaran</h3>
            <ul className="mt-2 divide-y">
              {selected.payments.length === 0 && (
                <li className="py-2 text-sm text-gray-600">
                  Belum ada pembayaran.
                </li>
              )}
              {selected.payments.map((payment) => (
                <li
                  className="flex justify-between py-2 text-sm"
                  key={payment.id}
                >
                  <span>{formatDate(payment.payment_date)}</span>
                  <span>{formatCurrency(payment.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </section>
  );
}

async function fetchProducts(token: string) {
  return apiFetch("/products", {}, token) as Promise<Product[]>;
}
async function fetchOrders(token: string) {
  return apiFetch("/direct-orders", {}, token) as Promise<DirectOrder[]>;
}
