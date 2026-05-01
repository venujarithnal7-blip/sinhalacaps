"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [coins, setCoins] = useState(null);
  const router = useRouter();

  useEffect(() => {
    async function loadUser() {
    const { data } = await supabase.auth.getSession();

if (!data.session) {
  router.push("/login");
  return;
}

setUser(data.session.user);

      if (!data.user) {
        router.push("/login");
        return;
      }

      setUser(data.user);

      const { data: profile } = await supabase
        .from("profiles")
        .select("credits")
        .eq("id", data.session.user.id)
        .single();

      setCoins(profile?.credits ?? 0);
    }

    loadUser();
  }, [router]);

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold">Dashboard</h1>

        <div className="mt-6 rounded-2xl bg-zinc-900 border border-zinc-800 p-6">
          <p className="text-zinc-400">Logged in as:</p>
          <p className="text-lg font-semibold">{user?.email}</p>

          <p className="mt-4 text-zinc-400">Your credits:</p>
          <p className="text-3xl font-bold text-emerald-400">
            {coins === null ? "Loading..." : coins}
          </p>
        </div>

        <button
          onClick={() => router.push("/")}
          className="mt-6 rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-black"
        >
          Go to Caption Generator
        </button>
      </div>
    </main>
  );
}