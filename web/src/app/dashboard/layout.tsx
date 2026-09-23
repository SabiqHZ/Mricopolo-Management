"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { token, user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !token) {
      router.replace("/login");
    }
  }, [loading, token, router]);

  if (loading || !token) return null;

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
