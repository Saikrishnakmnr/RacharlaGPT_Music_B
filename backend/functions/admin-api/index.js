import crypto from "node:crypto";

const env = (n, f = "") =>
  process.env[n] || f;

const ENDPOINT =
  env("APPWRITE_ENDPOINT");

const PROJECT =
  env("APPWRITE_PROJECT_ID");

const KEY =
  env("APPWRITE_API_KEY");

const DB =
  env("APPWRITE_DATABASE_ID");

const ORDERS =
  env("APPWRITE_ORDERS_TABLE", "orders");

const FILES =
  env("APPWRITE_FILES_TABLE", "order_files");

const EVENTS =
  env("APPWRITE_EVENTS_TABLE", "order_events");

const MESSAGES =
  env("APPWRITE_MESSAGES_TABLE", "messages");

const BUCKET =
  env(
    "APPWRITE_STORAGE_BUCKET",
    "order-files"
  );

const ADMIN =
  env("ADMIN_TOKEN");

const SITE =
  env(
    "SITE_URL",
    "https://songs.racharlagpt.in"
  );

const cors = {
  "Access-Control-Allow-Origin": SITE,
  "Access-Control-Allow-Headers":
    "Content-Type,Authorization,X-File-Name",
  "Access-Control-Allow-Methods":
    "GET,POST,PATCH,OPTIONS"
};

const json = (
  res,
  data,
  status = 200
) =>
  res.json(
    data,
    status,
    cors
  );

const bad = (
  res,
  message,
  status = 400
) =>
  json(
    res,
    { error: message },
    status
  );

async function aw(path, opt = {}) {

  const r = await fetch(
    ENDPOINT.replace(/\/$/, "") +
      "/v1" +
      path,
    {
      ...opt,

      headers: {
        "X-Appwrite-Project":
          PROJECT,

        "X-Appwrite-Key":
          KEY,

        ...(opt.headers || {})
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
    data = {
      raw: text
    };
  }

  if (!r.ok) {
    throw new Error(
      data.message || text
    );
  }

  return data;
}

const q = (field, value) =>
  encodeURIComponent(
    `equal("${field}",${JSON.stringify([
      String(value)
    ])})`
  );

async function rows(
  table,
  query = ""
) {

  const url =
    `/tablesdb/${DB}/tables/${table}/rows` +
    (
      query
        ? `?queries[]=${query}&limit=100`
        : "?limit=100"
    );

  const result =
    await aw(url);

  return result.rows || [];
}

async function create(
  table,
  data
) {

  return aw(
    `/tablesdb/${DB}/tables/${table}/rows`,
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

async function update(
  table,
  id,
  data
) {

  return aw(
    `/tablesdb/${DB}/tables/${table}/rows/${encodeURIComponent(id)}`,
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

function auth(req) {

  return (
    ADMIN &&
    req.headers.authorization ===
      `Bearer ${ADMIN}`
  );

}

function safe(order) {

  const copy = {
    ...order
  };

  delete copy.access_token_hash;

  return copy;
}

export default async ({
  req,
  res,
  error
}) => {

  try {

    if (req.method === "OPTIONS") {
      return json(res, {});
    }

    /*
     * ADMIN LOGIN
     */
    if (
      req.path === "/login" &&
      req.method === "POST"
    ) {

      if (!ADMIN) {
        return bad(
          res,
          "Admin token is not configured",
          500
        );
      }

      const password =
        String(
          (req.bodyJson || {})
            .password || ""
        );

      if (
        !password ||
        password.length !==
          ADMIN.length ||
        !crypto.timingSafeEqual(
          Buffer.from(password),
          Buffer.from(ADMIN)
        )
      ) {

        return bad(
          res,
          "Invalid credentials",
          401
        );

      }

      return json(
        res,
        {
          ok: true,
          token: ADMIN
        }
      );

    }

    if (!auth(req)) {
      return bad(
        res,
        "Unauthorized",
        401
      );
    }

    /*
     * LIST ORDERS
     */
    if (
      req.method === "GET" &&
      req.path === "/orders"
    ) {

      const result =
        await rows(ORDERS);

      result.sort(
        (a, b) =>
          String(b.created_at)
            .localeCompare(
              String(a.created_at)
            )
      );

      return json(
        res,
        {
          orders:
            result.map(safe)
        }
      );

    }

    /*
     * GET ONE ORDER
     */
    let match =
      req.path.match(
        /^\/orders\/([^/]+)$/
      );

    if (
      req.method === "GET" &&
      match
    ) {

      const orderNumber =
        decodeURIComponent(
          match[1]
        );

      const order =
        (
          await rows(
            ORDERS,
            q(
              "order_number",
              orderNumber
            )
          )
        )[0];

      if (!order) {
        return bad(
          res,
          "Order not found",
          404
        );
      }

      const files =
        await rows(
          FILES,
          q(
            "order_number",
            orderNumber
          )
        );

      const messages =
        await rows(
          MESSAGES,
          q(
            "order_number",
            orderNumber
          )
        );

      return json(
        res,
        {
          order: safe(order),
          files,
          messages
        }
      );

    }

    /*
     * UPDATE ORDER STATUS
     */
    if (
      req.method === "PATCH" &&
      match
    ) {

      const orderNumber =
        decodeURIComponent(
          match[1]
        );

      const order =
        (
          await rows(
            ORDERS,
            q(
              "order_number",
              orderNumber
            )
          )
        )[0];

      if (!order) {
        return bad(
          res,
          "Order not found",
          404
        );
      }

      const body =
        req.bodyJson || {};

      const allowed = [
        "ORDER_RECEIVED",
        "PAYMENT_VERIFIED",
        "REQUIREMENTS_RECEIVED",
        "IN_PRODUCTION",
        "QUALITY_CHECK",
        "READY",
        "DELIVERED",
        "NEEDS_MORE_INFORMATION",
        "REVISION_REQUESTED"
      ];

      if (
        body.status &&
        !allowed.includes(
          body.status
        )
      ) {

        return bad(
          res,
          "Invalid status"
        );

      }

      const data = {};

      if (body.status) {
        data.status =
          body.status;
      }

      if (
        typeof body.revision_count ===
        "number"
      ) {
        data.revision_count =
          body.revision_count;
      }

      await update(
        ORDERS,
        order.$id,
        data
      );

      await create(
        EVENTS,
        {
          order_number:
            orderNumber,

          event_type:
            body.status ||
            "ORDER_UPDATED",

          message:
            body.admin_note
              ? String(
                  body.admin_note
                ).slice(0, 2000)
              : null,

          created_at:
            new Date().toISOString(),

          created_by:
            "admin"
        }
      );

      return json(
        res,
        {
          ok: true
        }
      );

    }

    /*
     * ADMIN MESSAGE TO CUSTOMER
     */
    match =
      req.path.match(
        /^\/orders\/([^/]+)\/messages$/
      );

    if (
      req.method === "POST" &&
      match
    ) {

      const orderNumber =
        decodeURIComponent(
          match[1]
        );

      const body =
        String(
          (req.bodyJson || {})
            .body || ""
        ).trim();

      if (
        !body ||
        body.length > 2000
      ) {

        return bad(
          res,
          "Message is empty or too long"
        );

      }

      await create(
        MESSAGES,
        {
          order_number:
            orderNumber,

          sender_type:
            "admin",

          message:
            body,

          created_at:
            new Date().toISOString()
        }
      );

      return json(
        res,
        {
          ok: true
        }
      );

    }

    /*
     * UPLOAD FINAL MP3
     */
    match =
      req.path.match(
        /^\/orders\/([^/]+)\/mp3$/
      );

    if (
      req.method === "POST" &&
      match
    ) {

      const orderNumber =
        decodeURIComponent(
          match[1]
        );

      const order =
        (
          await rows(
            ORDERS,
            q(
              "order_number",
              orderNumber
            )
          )
        )[0];

      if (!order) {
        return bad(
          res,
          "Order not found",
          404
        );
      }

      const bytes =
        req.bodyBinary;

      if (
        !bytes?.length ||
        bytes.length >
          30 * 1024 * 1024
      ) {

        return bad(
          res,
          "MP3 is empty or too large"
        );

      }

      const name =
        (
          req.headers[
            "x-file-name"
          ] ||
          `${orderNumber}-final.mp3`
        )
          .replace(
            /[^a-zA-Z0-9._-]/g,
            "_"
          );

      const form =
        new FormData();

      form.append(
        "fileId",
        "unique()"
      );

      form.append(
        "file",
        new Blob(
          [bytes],
          {
            type:
              "audio/mpeg"
          }
        ),
        name
      );

      const uploaded =
        await aw(
          `/storage/buckets/${BUCKET}/files`,
          {
            method: "POST",
            body: form
          }
        );

      await create(
        FILES,
        {
          order_number:
            orderNumber,

          file_type:
            "mp3",

          file_name:
            name,

          file_id:
            uploaded.$id,

          mime_type:
            "audio/mpeg",

          created_at:
            new Date().toISOString()
        }
      );

      await update(
        ORDERS,
        order.$id,
        {
          status: "READY"
        }
      );

      await create(
        EVENTS,
        {
          order_number:
            orderNumber,

          event_type:
            "SONG_READY",

          message:
            "Final MP3 uploaded and order marked READY.",

          created_at:
            new Date().toISOString(),

          created_by:
            "admin"
        }
      );

      return json(
        res,
        {
          ok: true,
          file_id:
            uploaded.$id,
          status:
            "READY"
        }
      );

    }

    return bad(
      res,
      "Route not found",
      404
    );

  } catch (e) {

    error(
      e?.stack ||
      String(e)
    );

    return bad(
      res,
      "Server error",
      500
    );

  }

};
