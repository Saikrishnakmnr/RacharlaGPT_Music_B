# RacharlaGPT Music — Appwrite compatibility contract

This 360° build is designed to work with the Appwrite TablesDB/Storage structure already created for RacharlaGPT Music. **Do not recreate or rename the existing columns just because the GitHub folders/files changed.** Frontend/backend files can be replaced without changing the database schema.

## Existing database

- Database name: `RacharlaGPT Music`
- Database ID: `6aafb3630024cecf2eae`
- Region: Singapore

## `orders` — existing columns used by this build

- `order_number` — varchar, required, indexed
- `customer_name` — varchar, required
- `email` — email, required
- `occasion` — varchar, required
- `input_method` — varchar, required
- `description` — longtext, required
- `status` — varchar, required
- `payment_status` — varchar, required
- `price` — integer, required
- `campaign` — varchar, required
- `razorpay_order_id` — varchar, required
- `access_token_hash` — varchar, required
- `created_at` — datetime, required
- `paid_at` — datetime, optional
- `revision_count` — integer, required
- `download_count` — integer, required
- `last_download_at` — datetime, optional

**No new `orders` column is required by this 360° build.** Payment IDs are kept in the `order_events.metadata` field so the existing schema remains compatible.

## `order_files`

- `order_number` — varchar, indexed
- `file_type` — varchar (`voice`, `paper`, `mp3`)
- `file_name` — varchar
- `file_id` — varchar
- `mime_type` — varchar, optional
- `created_at` — datetime

## `order_events`

- `order_number` — varchar, indexed
- `event_type` — varchar
- `message` — longtext/text, optional
- `created_at` — datetime
- `created_by` — varchar, optional
- `metadata` — longtext/text, optional

## `messages`

- `order_number` — varchar, indexed
- `sender_type` — varchar (`customer`, `admin`)
- `message` — longtext/text
- `created_at` — datetime
- `read_at` — datetime, optional

## `offers`

The existing `offers` table can remain as-is. The active campaign price is currently controlled by backend environment variables, so the `offers` table does not need to be changed for this deployment.

## Storage bucket

- Name: `RacharlaGPT Music Files`
- ID: `order-files`
- Private
- File-level security ON
- Encryption ON
- Maximum 50 MB
- Existing allowed formats: jpg/jpeg/png/pdf/mp3/m4a/wav/webm

## Critical compatibility rule

The previous backend used TablesDB `queries[]` filtering and hit:

`Invalid query: Attribute not found in schema: order_number`

This build intentionally avoids that query form and uses cursor pagination + trusted server-side matching. **Do not reintroduce the old `queries[]` helper.**
