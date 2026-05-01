import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabase } from "@/lib/supabase";

export async function POST(req) {
  const formData = await req.formData();

  const order_id = formData.get("order_id");
  const status_code = formData.get("status_code");

  // 2 = success
  if (status_code !== "2") {
    return NextResponse.json({ success: false });
  }

  // 🔥 find payment
  const { data: payment } = await supabase
    .from("payments")
    .select("*")
    .eq("order_id", order_id)
    .single();

  if (!payment) return NextResponse.json({ success: false });

  // 🔥 add coins
  const { data: profile } = await supabase
    .from("profiles")
    .select("coins")
    .eq("id", payment.user_id)
    .single();

  const newCoins = (profile?.coins || 0) + payment.coins;

  await supabase
    .from("profiles")
    .update({ coins: newCoins })
    .eq("id", payment.user_id);

  // mark payment complete
  await supabase
    .from("payments")
    .update({ status: "completed" })
    .eq("order_id", order_id);

  return NextResponse.json({ success: true });
}