"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const packages = [
  {
    id: 1,
    name: "Starter",
    coins: 10,
    price: "100 LKR",
    badge: "",
    note: "Good for testing",
  },
  {
    id: 2,
    name: "Popular",
    coins: 50,
    price: "350 LKR",
    badge: "Most Popular",
    note: "Best for creators",
  },
  {
    id: 3,
    name: "Best Value",
    coins: 100,
    price: "600 LKR",
    badge: "Best Value",
    note: "For regular users",
  },
];

export default function BuyCoinsPage() {
  const [user, setUser] = useState(null);
  const [coins, setCoins] = useState(0);
  const [loadingId, setLoadingId] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    setUser(user);

    const { data } = await supabase
      .from("profiles")
      .select("coins")
      .eq("id", user.id)
      .single();

    setCoins(data?.coins || 0);
  }

async function handleBuy(pkg) {
  if (!user) {
    alert("Login first");
    return;
  }

   setLoadingId(pkg.id);

  try {
    const orderId = `ORDER_${Date.now()}_${user.id}_${pkg.coins}`;

    const res = await fetch("/api/payhere", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order_id: orderId,
        amount: pkg.price,
        coins: pkg.coins,
        user_id: user.id,
        email: user.email,
      }),
    });

    const data = await res.json();

    if (!data.hash) {
      alert("Payment init failed");
      return;
    }

    const payment = {
      sandbox: true,
      merchant_id: data.merchant_id,
      return_url: window.location.origin,
      cancel_url: window.location.origin,
      notify_url: `${window.location.origin}/api/payhere/notify`,
      order_id: orderId,
      items: `${pkg.coins} Coins`,
      amount: pkg.price,
      currency: "LKR",
      first_name: "User",
      last_name: "",
      email: user.email || "test@email.com",
      phone: "0771234567",
      address: "Colombo",
      city: "Colombo",
      country: "Sri Lanka",
      hash: data.hash,
    };

    window.payhere.startPayment(payment);

  } catch (err) {
    console.error(err);
    alert("Payment error");
  } finally {
   setLoadingId(null);
  }
}
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Buy Coins</h1>
            <p className="mt-2 text-zinc-400">
              Current coins: <span className="font-bold text-yellow-400">{coins}</span>
            </p>
            <p className="mt-1 text-sm text-red-400">
              Test mode: payments are not connected yet.
            </p>
          </div>

          <Link
            href="/"
            className="rounded-2xl bg-white px-4 py-3 font-semibold text-black hover:bg-zinc-200"
          >
            Back Home
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {packages.map((item) => (
            <div
              key={item.id}
              className={`relative rounded-3xl border p-6 ${
                item.badge === "Most Popular"
                  ? "border-yellow-400 bg-zinc-900 shadow-lg shadow-yellow-400/10"
                  : "border-zinc-800 bg-zinc-900"
              }`}
            >
              {item.badge && (
                <div className="absolute right-4 top-4 rounded-full bg-yellow-400 px-3 py-1 text-xs font-bold text-black">
                  {item.badge}
                </div>
              )}

              <h2 className="text-2xl font-bold">{item.name}</h2>
              <p className="mt-2 text-sm text-zinc-400">{item.note}</p>

              <p className="mt-6 text-4xl font-extrabold">{item.price}</p>
              <p className="mt-2 text-xl font-semibold text-yellow-400">
                {item.coins} coins
              </p>

              <ul className="mt-6 space-y-2 text-sm text-zinc-300">
                <li>• Sinhala caption generation</li>
                <li>• Editable captions</li>
                <li>• Timing controls</li>
                <li>• Style controls</li>
              </ul>

              <button
  onClick={() => handleBuy(item)}
  disabled={loadingId === item.id}
  className="mt-6 w-full rounded-2xl bg-yellow-400 px-4 py-3 font-semibold text-black hover:bg-yellow-300 disabled:opacity-60"
>
  {loadingId === item.id ? "Loading..." : "Buy Now"}
</button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}