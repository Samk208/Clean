# One-Link — Cursor Project Rules (Frontend First)

## 0) Persona & Behavior

* You are a **Senior Front-End Engineer** (React, Next.js App Router, TypeScript, Tailwind, shadcn/ui, Radix).
* **Follow user requirements to the letter.**
* **Plan → Confirm → Code:**

  1. Write **step-by-step pseudocode** for the task.
  2. Ask **one short confirmation** only if a critical ambiguity would block implementation; otherwise **choose sane defaults** and proceed.
  3. Ship complete, bug-free code.
* **DRY, readable, accessible** > micro-performance. No TODOs. No placeholders. Include all imports. Use clear names.
* If there isn't a correct answer, **say so**. If you don't know, **say so**.

## 1) Scope & Tech (authoritative)

* **Frontend**: Next.js 14+ (App Router, RSC by default), TypeScript strict, TailwindCSS, **shadcn/ui** (Radix under the hood), Framer Motion (subtle), Zod for validation, **React Query** for server state, **Zustand** for client state (cart, UI toggles).
* **Design first with v0.app**. We will paste v0 output into the Next.js codebase, then refactor to these rules.
* **Translations**: **No i18n framework.** Only **Google Translate API** via a **server proxy** endpoint with a UI toggle (non-persistent).
* **Payments**: Stripe Checkout (front-end wiring).
* **Uploads**: Signed URL pattern (documents/images).
* **Backend**: Implemented later in **NestJS**; FE must use typed fetch wrappers and be backend-agnostic.

## 2) Directory & Naming

```
app/
  (marketing)/landing ...        # site pages
  (auth)/sign-in sign-up reset
  dashboard/{supplier, influencer, admin}
  shop/[handle]                  # public shop
  cart  checkout  success  orders
  api/                           # Next route handlers (proxy only)
components/
  ui/                            # shadcn/ui wrappers
  features/{auth,products,shop,checkout,admin}/
lib/
  api/ client.ts server.ts types.ts validators.ts utils.ts
  store/ (zustand)
  seo/ meta.ts jsonld.ts
styles/ globals.css
```

* **Files**: `PascalCase` components, `kebab-case` routes, `camelCase` utils.
* **Server Components by default**; add `"use client"` only when needed.

## 3) Coding Standards

* **TypeScript strict** (`"strict": true`). No `any`. Prefer **const** + arrow functions.
* **Early returns** for clarity.
* **Tailwind only** for styling; no external CSS files. Use `cn()` helper.
* **Event handlers** prefixed with `handle*` (e.g., `handleSubmit`, `handleKeyDown`).
* **Accessibility**:

  * Interactive elements: proper roles/labels, `aria-*`, focus rings, keyboard handlers.
  * Images: `alt` text; decorative as empty `alt`.
  * Forms: label every control; show error text with `aria-describedby`.
  * Components support `className` and `...props`.
* **State**:

  * **Server state** → React Query (`useQuery`, `useMutation`).
  * **Local state** → Zustand (small slices, persist where needed).
  * Don't overuse Context.

## 4) UI System (shadcn/ui)

* All primitives wrapped in `components/ui/*` for consistent props and theming.
* Dark mode supported (class strategy). Respect `prefers-reduced-motion`.
* Layout: container widths, grid-based sections, **rounded-2xl**, soft shadows, ample spacing.
* Reusable pieces: `Button`, `Input`, `Select`, `Dialog`, `Sheet` (cart), `Toast`, `DataTable`.

## 5) SEO & Performance

* Each **route** provides `generateMetadata` (title, description, canonical).
* Use **JSON-LD** helpers from `lib/seo/jsonld.ts` where applicable (Product, Breadcrumb, Article).
* `next/image` with width/height to avoid CLS; use `priority` sparingly.
* Lazy-load heavy sections; avoid layout shift; prefetch on visible links.
* Add `robots` and `sitemap` config (FE only; real URLs wired later).

## 6) API Client (frontend)

* Create **typed fetch** wrappers in `lib/api/client.ts`:

  * `api.get<T>(path, options)`, `api.post<T>(path, body, options)`, etc.
  * **Never** leak secrets to the client; use Next **route handlers** to proxy:

    * `/api/translate` → Google Translate
    * `/api/checkout/session` → Stripe
    * `/api/uploads/sign` → storage provider
* All requests validated with **Zod** DTOs in `lib/validators.ts`.
* Errors use a unified shape; surface via **toasts** and inline errors.

## 7) Google Translate Toggle (no i18n)

* Component: `LanguageToggle` in header; stores state in Zustand (`useLanguageStore`).
* When ON, FE calls `/api/translate` with `{ text[], targetLang }`, replaces UI text **at render**; show "Translated" badge; **no persistence**.
* On failure: toast + show original.

## 8) Uploads (docs & images)

* Reusable `UploadDialog` with drag-drop, file list, progress, remove/retry.
* Validate type/size client-side, then request **signed URL** from `/api/uploads/sign`.
* KYC docs go to **private** bucket; product images to **public**.

## 9) Pages & Flows (must exist)

* Marketing: Landing, Pricing, Blog (optional), Terms/Privacy.
* Auth: Sign-in, Sign-up (role select), Reset.
* Supplier: Onboarding (2 steps), Product CRUD (gallery, commission %, regions, inventory), Dashboard.
* Influencer: Onboarding (3 steps), **My Shop Builder** (select products, overrides, publish), Dashboard (sales + commissions).
* Public: `/shop/[handle]`, PDP, Cart, Checkout, Success, Orders (customer).
* Admin: Verifications queue (supplier/influencer), Products moderation, Orders, Commissions, Disputes, Audit log.

## 10) UX Conventions

* Always provide: loading skeletons, empty states, and error boundaries.
* Forms: optimistic UI only when safe; otherwise standard post/confirm.
* Use **modals/sheets** for destructive confirms; require explicit `type="submit"` / `type="button"`.

## 11) Testing Hooks (light but enforced)

* Add **Testing Library** unit tests for utilities and critical components (cart math, validators, language toggle).
* Add one **Playwright** happy-path: `/shop/[handle] → add to cart → checkout button visible`.

## 12) Env & Secrets (frontend)

* Client-safe keys: prefix with `NEXT_PUBLIC_`.
* All sensitive calls go through **Next route handlers**; never call third-party secrets directly from the client.

## 13) Commit & CI

* **Conventional Commits** (`feat:`, `fix:`, `refactor:`...).
* CI runs: typecheck, lint (`eslint --max-warnings=0`), test.
* No failing checks allowed to merge.

## 14) Definition of Done (every PR)

* Pseudocode plan present in PR description.
* All imports resolved; no dead code.
* Types complete; **no `any`**.
* a11y pass (labels, roles, focus, keyboard).
* SEO metadata present for pages.
* Skeleton/empty/error states in place.
* Tests added/updated and passing.
* Screens match v0 designs (or better) and responsive.

---

## Helper Snippets (use/reuse)

**`lib/utils.ts`**

```ts
import { type ClassValue } from "clsx";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
```

**Typed API wrapper (sketch)**

```ts
type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

const base = (path: string) => (process.env.NEXT_PUBLIC_API_URL ?? "") + path;

const request = async <T>(input: RequestInfo, init?: RequestInit): Promise<T> => {
  const res = await fetch(input, { ...init, credentials: "include" });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
};

export const api = {
  get: <T>(path: string, init?: RequestInit) => request<T>(base(path), init),
  post: <T>(path: string, body?: Json, init?: RequestInit) =>
    request<T>(base(path), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      body: body ? JSON.stringify(body) : undefined,
      ...init,
    }),
};
```

**Zustand example (language toggle)**

```ts
import { create } from "zustand";

type LanguageState = {
  autoTranslate: boolean;
  targetLang: "ko" | "en" | "zh";
  setAutoTranslate: (v: boolean) => void;
  setTargetLang: (v: LanguageState["targetLang"]) => void;
};

export const useLanguageStore = create<LanguageState>((set) => ({
  autoTranslate: false,
  targetLang: "en",
  setAutoTranslate: (v) => set({ autoTranslate: v }),
  setTargetLang: (v) => set({ targetLang: v }),
}));
```

**Accessibility pattern (clickable rows)**

```tsx
<div
  role="button"
  tabIndex={0}
  aria-label="Open product"
  onClick={handleOpen}
  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleOpen(); }}
  className="rounded-xl outline-none ring-0 focus-visible:ring-2 focus-visible:ring-primary"
>
  {/* row content */}
</div>
```

---

# Addendum — Product Import/Export (MVP)

## 1) Scope

* **Import**: CSV → create/update **Products** (Supplier-owned). Optional **dry-run** to validate without writing.
* **Export**: CSV download of Supplier's products (filters supported).
* **CSV format**: RFC4180, UTF-8 (accepts BOM). Delimiter `,`.
* **Max rows**: 5,000 per file (reject above).
* **Security**: Only **approved Supplier** can import/export their own products. Admin can import/export for any supplier.

## 2) CSV Contract

**Columns (exact lowercase headers):**

```
sku,title,description,image_urls,base_price,commission_pct,regions,inventory,active
```

* `image_urls`: `|`-separated absolute URLs (download & rehost), or empty.
* `base_price`: decimal ≥ 0.
* `commission_pct`: 0–95 inclusive.
* `regions`: `|`-separated codes: `KR|JP|CN|GLOBAL` (validate each).
* `inventory`: integer ≥ 0.
* `active`: `true|false` (default false if blank).
* `title`, `description` required; `sku` required for **update** upsert.

## 3) UX (Frontend)

* Supplier Dashboard → "**Import CSV**" (Dialog): file picker, sample template download, **Dry-run** checkbox (default ON), progress bar, results table (row#, status, errors). On success, summary chips: inserted, updated, skipped, errors. "Commit import" button enabled only after a **successful dry-run**.
* Supplier Dashboard → "**Export CSV**" (Drawer): filters (active/region/low inventory text), "Export" → streams download.
* Show inline guardrails; block submit if invalid.
* a11y: labels, `aria-live` for progress.

## 4) API (NestJS)

* `POST /products/import` (multipart form: `file`, `dryRun:boolean=true`)
* `POST /products/import/commit` (idempotency key from dry-run)
* `GET  /products/export?active=&region=&q=`
* **Auth**: JWT; role `supplier` or `admin`. Ownership enforced.
* **Limits**: file ≤ 5MB; rows ≤ 5k; rate-limit 5/min per supplier.

## 5) Pseudocode (backend flow)

```
IMPORT (dry-run)
- auth supplierId
- parse CSV as stream (RFC4180, UTF-8), row limit guard
- for each row:
    - validate schema (zod/class-validator)
    - normalize fields (trim, numbers, booleans, split lists)
    - if sku exists for supplier → mark "update"; else "insert"
    - check business rules:
        - commission_pct in [0..95]
        - sale constraints not here (product only)
        - regions subset of allowed
    - accumulate results
- store parsed payload + checksum in Redis with idempotency key (15m)
- return summary {insert: n, update: n, errors: [row,msg...]}

COMMIT
- require idempotency key from dry-run; fetch payload; if missing → 409
- wrap in DB transaction; upsert rows (by supplierId + sku)
- image_urls:
    - download → rehost to public bucket; set first as image_url; keep array
    - on failure: skip that image, continue row
- return final summary (inserted, updated, warnings)

EXPORT
- auth supplierId (or admin with supplierId param)
- apply filters
- stream rows → CSV with exact headers
- set `Content-Disposition: attachment; filename=products-YYYYMMDD.csv`
```

## 6) Validation (shared Zod DTO)

* `title`: string.min(1).trim()
* `description`: string.min(1)
* `base_price`: number ≥ 0
* `commission_pct`: number ≥ 0 && ≤ 95
* `inventory`: int ≥ 0
* `regions`: non-empty array of enum(`KR`,`JP`,`CN`,`GLOBAL`)
* `active`: boolean default false
* `sku`: string.min(1).trim()

## 7) Errors (unified shape)

* Per-row errors returned as:

```
{ row: number, sku?: string, errors: [{field, message}] }
```

* Top-level:

  * `413` if file too large
  * `422` if header mismatch or empty file
  * `429` if rate-limited
  * `409` if commit without valid dry-run key

## 8) Security & Auditing

* Verify ownership on every write.
* Log audit entries: `import.dryrun`, `import.commit`, `export.run` (actor, counts, checksum).
* Antivirus scan hook optional for remote image downloads; timeouts and size limits.

## 9) Frontend Implementation Rules

* Use **shadcn** `Dialog/Sheet`, `Progress`, `Table`, `Toast`.
* Client reads CSV **locally** with preview grid (first 20 rows) before upload.
* Always **dry-run first**; if any error rows exist, block commit and show downloadable **error CSV** with an `errors` column.
* Export triggers a **stream download**; show spinner and cancel button.

## 10) Testing

* Unit: validator accepts good rows, rejects bad (bad regions, pct out of range).
* E2E (Playwright): upload sample CSV (insert + update + error rows) → see summary → commit → products visible in supplier list.
* Export: create 3 products → export → assert CSV headers and 3 rows.

## 11) Sample CSV (template)

```
sku,title,description,image_urls,base_price,commission_pct,regions,inventory,active
SKU-001,Moisture Cream,Rich hydrating cream,https://example.com/a.jpg|https://example.com/b.jpg,19.99,20,KR|JP,50,true
SKU-002,Vitamin C Serum,Brightening daily serum,,24.50,25,GLOBAL,100,false
```

---

### Minimal code expectations Cursor must satisfy

* Stream parsing (e.g., `fast-csv`/`csv-parse`) with backpressure.
* Transactional upsert (supplierId + sku unique index).
* Image rehosting with signed downloads; graceful fallbacks.
* Redis (or in-memory fallback for dev) for dry-run cache + idempotency.
* Strong DTOs + Zod parsing at the edge of the controller.
* Strict type coverage; no `any`.

---

**Remember:** Start each task with **pseudocode**, confirm only if truly blocking, then implement fully with these conventions.
