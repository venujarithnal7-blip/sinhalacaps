import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

// Use service role key here - NOT anon key (needs admin access)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  const formData = await req.formData();

  const merchant_id     = formData.get("merchant_id");
  const order_id        = formData.get("order_id");
  const payhere_amount  = formData.get("payhere_amount");
  const payhere_currency = formData.get("payhere_currency");
  const status_code     = formData.get("status_code");
  const md5sig          = formData.get("md5sig");

  const merchant_secret = process.env.PAYHERE_MERCHANT_SECRET;

  // ✅ Verify the payment is legitimate
  const secretHash = crypto
    .createHash("md5")
    .update(merchant_secret)
    .digest("hex")
    .toUpperCase();

  const expectedSig = crypto
    .createHash("md5")
    .update(
      merchant_id +
      order_id +
      payhere_amount +
      payhere_currency +
      status_code +
      secretHash
    )
    .digest("hex")
    .toUpperCase();

  if (md5sig !== expectedSig) {
    console.error("Invalid PayHere signature");
    return new Response("Invalid signature", { status: 400 });
  }

  // ✅ Only process successful payments (status 2 = success)
  if (status_code !== "2") {
    console.log("Payment not successful, status:", status_code);
    return new Response("OK", { status: 200 });
  }

  // ✅ Get coins from order_id
  // order_id format: "ORDER_1234567890_USERID_COINS"
  const parts = order_id.split("_");
  const user_id = parts[2];
  const coinsToAdd = parseInt(parts[3]);

  if (!user_id || isNaN(coinsToAdd)) {
    console.error("Invalid order_id format:", order_id);
    return new Response("Invalid order", { status: 400 });
  }

  // ✅ Get current coins and add
  const { data: profile } = await supabase
    .from("profiles")
    .select("coins")
    .eq("id", user_id)
    .single();

  const newCoins = (profile?.coins || 0) + coinsToAdd;

  await supabase
    .from("profiles")
    .update({ coins: newCoins })
    .eq("id", user_id);

  console.log(`Added ${coinsToAdd} coins to user ${user_id}. New total: ${newCoins}`);

  return new Response("OK", { status: 200 });
}