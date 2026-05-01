import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/lib/supabase";

export async function POST(req) {
  try {
    const { packageData, user } = await req.json();

    if (!user?.id) {
      return NextResponse.json({ success: false, error: "No user" });
    }

    const orderId = uuidv4();

    await supabase.from("payments").insert({
      user_id: user.id,
      package_name: packageData.name,
      coins: packageData.coins,
      amount: Number(packageData.price.replace("$", "")),
      status: "pending",
      gateway: "payhere",
      order_id: orderId,
    });

    return NextResponse.json({
      success: true,
      orderId,
      paymentData: {
        merchant_id: "YOUR_PAYHERE_MERCHANT_ID",
        return_url: "http://localhost:3000/buy-coins",
        cancel_url: "http://localhost:3000/buy-coins",
        notify_url: "http://localhost:3000/api/payment-notify",

        order_id: orderId,
        items: packageData.name,
        amount: packageData.price.replace("$", ""),
        currency: "USD",

        first_name: "User",
        last_name: "Test",
        email: user.email,
        phone: "0770000000",
        address: "Colombo",
        city: "Colombo",
        country: "Sri Lanka",
      },
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err.message,
    });
  }
}