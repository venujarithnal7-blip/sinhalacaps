import crypto from "crypto";

export async function POST(req) {
  const body = await req.json();

  const { order_id, amount } = body;

  const merchant_id = process.env.PAYHERE_MERCHANT_ID;
  const merchant_secret = process.env.PAYHERE_MERCHANT_SECRET;

  const hash = crypto
    .createHash("md5")
    .update(
      merchant_id +
        order_id +
        amount +
        "LKR" +
        crypto.createHash("md5").update(merchant_secret).digest("hex").toUpperCase()
    )
    .digest("hex")
    .toUpperCase();

  return Response.json({
    merchant_id,
    hash,
  });
}