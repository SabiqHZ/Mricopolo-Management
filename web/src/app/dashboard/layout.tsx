"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { token, user, loading, logout } = useAuth();
  const router = useRouter();

  // State untuk memastikan render dilakukan di client-side (mencegah Hydration Error)
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!loading && !token) {
      router.replace("/login");
    }
  }, [loading, token, router]);

  // Cegah render jika masih di server/SSR, masih loading auth, atau tidak ada token
  if (!isMounted || loading || !token) {
    return null;
  }

  return (
    <div className="flex min-h-screen">
      <nav className="w-56 bg-gray-900 text-white p-4 space-y-2">
        <p className="text-sm text-gray-400 mb-4">{user?.username}</p>
        <a href="/dashboard" className="block py-1">
          Overview
        </a>
        <a href="/dashboard/stores" className="block py-1">
          Stores
        </a>
        <a href="/dashboard/products" className="block py-1">
          Products
        </a>
        <a href="/dashboard/prices" className="block py-1">
          Store Prices
        </a>
        <a href="/dashboard/droppings" className="block py-1">
          Droppings
        </a>
        <a href="/dashboard/returns" className="block py-1">
          Returns
        </a>
        <a href="/dashboard/invoices" className="block py-1">
          Invoices
        </a>
        <button
          onClick={() => {
            logout();
            router.push("/login");
          }}
          className="block py-1 text-red-400 text-left"
        >
          Logout
        </button>
      </nav>
      <main className="flex-1 p-8 bg-gray-50">{children}</main>
    </div>
  );
}
