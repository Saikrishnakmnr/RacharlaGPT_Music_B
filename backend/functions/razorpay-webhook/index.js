import crypto from "node:crypto";

const env = n =>
  process.env[n] || "";

const ENDPOINT =
  env("APPWRITE_ENDPOINT");

const PROJECT =
  env("APPWRITE_PROJECT_ID");

const KEY =
  env("APPWRITE_API_KEY");

const DB =
  env("APPWRITE_DATABASE_ID");

const ORDERS =
  env(
    "APPWRITE_ORDERS_TABLE",
    "orders"
  );

const EVENTS =
  env(
    "APPWRITE_EVENTS_TABLE",
    "order_events"
  );

const SECRET =
  env("RAZORPAY_WEBHOOK_SECRET");

function json(
  res,
  data,
  status = 200
) {
  return res.json(data, status);
}

async function aw(
  path,
  options = {}
) {

  const r = await fetch(
    ENDPOINT.replace(/\/$/, "") +
      "/v1" +
      path,
    {
      ...options,

      headers: {
        "X-Appwrite-Project":
          PROJECT,

        "X-Appwrite-Key":
          KEY,

        ...(options.headers || {})
      }
    }
  );

  const text =
    await r.text();

  let data = {};

  try {
    data =
      text
        ? JSON.parse(text)
        : {};
  } catch {
    data = {};
  }

  if (!r.ok) {
    throw new Error(
      data.message || text
    );
  }

  return data;
}

async function listOrder(
  orderNumber
) {

  const query =
    encodeURIComponent(
      `equal("order_number",${JSON.stringify([
        String(orderNumber)
      ])})`
    );

  const result =
    await aw(
      `/tablesdb/${DB}/tables/${ORDERS}/rows` +
      `?queries[]=${query}&limit=1`
    );

  return result.rows?.[0];

}

async function update(
  id,
  data
) {

  return aw(
    `/tablesdb/${DB}/tables/${ORDERS}/rows/${encodeURIComponent(id)}`,
    {
      method: "PATCH",

      headers: {
        "Content-Type":
          "application/json"
      },

      body: JSON.stringify({
        data
      })
    }
  );

}

async function event(
  data
) {

  return aw(
    `/tablesdb/${DB}/tables/${EVENTS}/rows`,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json"
      },

      body: JSON.stringify({
        rowId: "unique()",
        data
      })
    }
  );

}

export default async ({
  req,
  res,
  error
}) => {

  try {

    if (req.method !== "POST") {
      return json(
        res,
        {
          error: "POST only"
        },
        405
      );
    }

    if (!SECRET) {
      return json(
        res,
        {
          error:
            "Webhook secret not configured"
        },
        500
      );
    }

    const raw =
      req.bodyText || "";

    const signature =
      req.headers[
        "x-razorpay-signature"
      ] || "";

    const expected =
      crypto
        .createHmac(
          "sha256",
          SECRET
        )
        .update(raw)
        .digest("hex");

    if (
      !signature ||
      signature.length !==
        expected.length ||
      !crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected)
      )
    ) {

      return json(
        res,
        {
          error:
            "Invalid signature"
        },
        401
      );

    }

    const body =
      JSON.parse(raw);

    const payment =
      body.payload
        ?.payment
        ?.entity;

    const razorpayOrder =
      body.payload
        ?.order
        ?.entity;

    const orderNumber =
      payment?.notes?.order_number ||
      payment?.notes?.receipt ||
      razorpayOrder?.receipt;

    if (!orderNumber) {

      return json(
        res,
        {
          ok: true,
          ignored: true
        }
      );

    }

    const row =
      await listOrder(
        orderNumber
      );

    if (!row) {

      return json(
        res,
        {
          ok: true,
          ignored: true
        }
      );

    }

    /*
     * PAYMENT SUCCESS
     */
    if (
      body.event ===
        "order.paid" ||
      body.event ===
        "payment.captured"
    ) {

      await update(
        row.$id,
        {
          payment_status:
            "PAID",

          status:
            row.status ===
              "ORDER_RECEIVED"
              ? "PAYMENT_VERIFIED"
              : row.status,

          paid_at:
            new Date().toISOString()
        }
      );

      await event(
        {
          order_number:
            orderNumber,

          event_type:
            "PAYMENT_SUCCESS",

          message:
            `Razorpay event: ${body.event}`,

          created_at:
            new Date().toISOString(),

          created_by:
            "razorpay"
        }
      );

    }

    /*
     * PAYMENT FAILED
     */
    if (
      body.event ===
      "payment.failed"
    ) {

      await update(
        row.$id,
        {
          payment_status:
            "FAILED"
        }
      );

      await event(
        {
          order_number:
            orderNumber,

          event_type:
            "PAYMENT_FAILED",

          message:
            "Razorpay payment failed.",

          created_at:
            new Date().toISOString(),

          created_by:
            "razorpay"
        }
      );

    }

    return json(
      res,
      {
        ok: true
      }
    );

  } catch (e) {

    error(
      e?.stack ||
      String(e)
    );

    return json(
      res,
      {
        error:
          "Server error"
      },
      500
    );

  }

};
