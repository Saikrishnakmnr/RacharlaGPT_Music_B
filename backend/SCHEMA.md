# Appwrite schema

Use **TablesDB**. Keep all tables private to the public client; server functions use the Appwrite API key/dynamic key.

## `orders`
- `order_number` — varchar, required, indexed, unique
- `customer_name` — varchar
- `email` — email
- `occasion` — varchar
- `input_method` — enum/string
- `description` — text
- `status` — varchar
- `payment_status` — varchar
- `price` — integer
- `campaign` — varchar
- `razorpay_order_id` — varchar
- `payment_id` — varchar
- `access_token_hash` — varchar
- `created_at` — datetime
- `paid_at` — datetime, optional
- `revision_count` — integer

## `order_files`
- `order_number` — varchar, indexed
- `type` — varchar (`voice`, `paper`, `mp3`)
- `file_id` — varchar
- `file_name` — varchar
- `created_at` — datetime

## `order_events`
- `event_id` — varchar, indexed, unique where supported
- `order_number` — varchar, optional
- `event` — varchar
- `created_at` — datetime

## Storage bucket: `order-files`
- Private bucket; do not grant public read access.
- Enable file-level security.
- Allow: audio, PDF, JPG, JPEG, PNG, WEBP, MP3.
- Keep customer uploads and final MP3s private.


## `messages`
- `order_number` — varchar, indexed
- `sender_role` — varchar (`customer`, `admin`)
- `body` — text
- `created_at` — datetime
