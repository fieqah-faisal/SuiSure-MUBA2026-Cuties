# SuiSure — project context

Hackathon project for MUBA Blockchain Hackathon 2026, Sui Track 01 (Payments & Stablecoins)
and Track 02 (AI × Sui).

**Submission closes 5 September 2026, 11:59 PM MYT. Physical pitch at APU on 6 September.**

---

## What this is

An **on-chain merchant payment QR** for Sui.

A merchant registers on our site and receives an on-chain `MerchantCredential`. They generate
a QR bound to an on-chain `PaymentIntent`. A customer scans it, or types a plain sentence
("Pay Kopitiam RM12"), reviews what the chain says, and signs.

The goal is for on-chain payment to feel exactly like scanning a normal merchant QR, while
adding anti-tampering and replay protection that ordinary crypto payments do not have.

## Positioning — get this right in any copy you write

**We are not competing with DuitNow QR.** DuitNow moves ringgit through banks. We cannot
integrate with banks without KYC licensing, and a SuiSure user never scans a DuitNow code.
Never write copy claiming we fix DuitNow fraud — it is false and it will be taken apart.

**Our competitor is how crypto merchant payments work today:** the merchant shows a wallet
address, or a QR containing an address and an amount. The customer scans, sends, and hopes.
That model fails four ways — the recipient is an unverifiable hex string, anyone can swap the
QR, requests can be replayed, and payment is irreversible.

We are solving **trust and safety in crypto merchant payments.**

DuitNow may be referenced in exactly two ways, both honest: as the UX we are deliberately
copying, and as evidence that QR sticker-swap attacks happen in Malaysia at scale. Never as a
competitor or a market.

---

## Architecture — two layers

**Sui Payment Kit is the cashier. Our module is the security guard standing in front of it.**

Payment Kit (`process_registry_payment<T>`) takes a coin, verifies the amount matches, blocks
duplicate payments via a registry, moves the funds, returns a `PaymentReceipt`, and emits an
event. It knows nothing about merchants and has no concept of a request expiring.

Critically, its `receiver` is an `Option<address>` **parameter supplied by the caller**.
Payment Kit does not verify who that is — its own docs say to verify receiver, amount, coin
type and package IDs against your own expected values rather than trusting client-supplied
data.

**Our module supplies that address, read from the `MerchantCredential`.** That is the entire
reason our contract exists, and it is the pitch: we use the ecosystem standard and close the
gap the standard leaves open.

## The core security property — do not break this

**Our QR carries a payment intent ID and a merchant object ID. It never carries a destination
address.** `paymentIntentQrPayloadSchema` in `src/types/domain.ts` enforces this today.

Any change that lets a recipient address travel in the QR payload, a URL parameter, or AI
output destroys the product.

Four things are verified against on-chain state before anything is signed:

1. The payment intent is legitimate and exists on chain.
2. The merchant is registered and the credential is active.
3. The amount matches the canonical on-chain request.
4. The request has not expired and has not already been paid.

Related invariants:

- The AI never returns a trusted wallet address. Merchant resolution happens against on-chain
  objects *after* AI interpretation.
- The AI never signs or submits a transaction. It prepares something a human reviews.
- Merchant registration numbers and contact emails must never be written on-chain.
- We are non-custodial. Coins move wallet to wallet. We never hold funds. This means the
  registry's `registry_managed_funds` config **must be false** — if true, funds accumulate in
  the registry and we become custodial.

---

## Current state

The Move contract is **built, tested and live on testnet**. The website is **still entirely
mocked** and does not touch the chain. Both halves of that sentence matter.

Done:

- `move/` — `suisure::payments`, published to testnet. `sui move test` runs 8 tests, five of
  them failure cases. Deployed IDs are in `src/config/sui.ts`; the README deployment section
  carries the full list plus four verified transaction digests, one success and three
  rejections.
- Payment Kit registry created, `registry_managed_funds` confirmed false, so payments go
  wallet to wallet and we stay non-custodial.
- Two demo merchant credentials registered on chain.
- `@mysten/sui` v2 installed; `src/services/sui/` holds a gRPC adapter.

Not done:

- **Nothing imports `src/services/sui/`.** The UI runs on `MOCK_` data end to end. Wiring the
  adapter into `payment.service.ts` and `merchant.service.ts` is the whole remaining gap
  between a working contract and a working demo.
- `functions/` — the AI backend endpoint. Not started.
- `@mysten/dapp-kit` — not installed. No wallet connection.
- Real AI. `src/services/ai-assistant/ai.service.ts` is regex matching, not a model call.
- Real transaction digests in the UI. `payment.service.ts` still generates random strings, so
  receipt explorer links 404.

> **`mockMode` does not do what its name suggests.** Only `zkLogin.service.ts` and
> `login.tsx` read it. `payment.service.ts` and `merchant.service.ts` never check it and
> return mock data unconditionally. Setting it to `false` breaks login and changes nothing
> about payments. Do not treat flipping it as the switch to live.

---

## Team ownership — stay in your lane

| Owner | Responsibility | Files |
|---|---|---|
| Member 1 — Aida | Move contract, Payment Kit integration, testnet deployment, transaction adapter | `move/**`, `src/services/sui/**`, `src/config/sui.ts` |
| Member 2 — Aidan | AI endpoint, structured output, merchant resolution, validation | `functions/**`, `src/services/ai-assistant/**`, AI schemas |
| Member 3 — Syafieqah | Wallet integration, replacing mocks, QR/review/receipt UI, deployment | `src/routes/**`, `src/components/**`, hosting config |

Do not edit files owned by someone else. Propose the change instead.

---

## Move package design

Module `suisure::payments`, Sui Move 2024 edition. Generic over the coin type `T`.

> Naming note: our struct is called `PaymentIntent` to match the existing frontend types and
> QR schema. This is **not** Sui's own "Payment Intents" primitive — different thing, same
> word. Do not rename the frontend; renaming 1,750 lines three days out is a bad trade.

| Struct | Abilities | Ownership | Fields |
|---|---|---|---|
| `AdminCap` | `key, store` | Owned (deployer) | `id` |
| `MerchantCredential` | `key` | **Shared** | `id`, `name: String`, `category: String`, `payout: address`, `active: bool` |
| `PaymentIntent` | `key` | **Shared** | `id`, `credential_id: ID`, `amount: u64`, `amount_myr: u64`, `coin_type: ascii::String`, `nonce: ascii::String`, `description: String`, `order_ref: String`, `expiry_ms: u64`, `created_at_ms: u64`, `paid: bool` |
| `PaymentCompleted` | `copy, drop` | Event | intent ID, credential ID, merchant, amount, payer |
| `SuiSureReceipt` | `key, store` | Owned (**payer**) | proof of payment handed to the customer |

`amount` is in the coin's smallest unit and is the figure enforced. `amount_myr` is **integer
sen** for display only — Move has no floats, so RM12.50 is `1250`.

`description` and `order_ref` are on chain deliberately. The review screen claims to show
canonical Sui state, so anything it displays has to come from there.

`nonce` and `coin_type` are `std::ascii::String`, not `std::string::String` — Payment Kit's
nonce is ASCII, and mixing the two will not compile.

Payment Kit's own `PaymentReceipt` cannot be given to the customer: it has no `key`, so it is
a value rather than an object, and all its fields are private with no accessors. Hence
`SuiSureReceipt`, built from values this module verified itself.

Shared vs owned is a one-way decision. `MerchantCredential` and `PaymentIntent` must both be
shared — the customer is a different party from the merchant and must read both.

### Functions

- `init(ctx)` — runs once at publish. Mints `AdminCap` to the deployer.
- `register_merchant(_: &AdminCap, name, category, payout, ctx)` — shares a
  `MerchantCredential`.
- `set_merchant_active(_: &AdminCap, &mut MerchantCredential, active)` — switches a merchant
  off without republishing.
- `create_payment_intent<T>(&MerchantCredential, amount, amount_myr, nonce, description,
  order_ref, expiry_ms, &Clock, ctx)` — shares a `PaymentIntent`. **Generic over `T`**, which
  is how the request records the coin type it must be settled in; it also needs the `Clock`
  for `created_at_ms`.
- `pay_payment_intent<T>(...)` — the one that matters.

There is no `msg.sender` modifier in Move. Requiring `&AdminCap` in the signature *is* the
access check.

### `pay_payment_intent<T>` — order of operations

Parameters: `&MerchantCredential`, `&mut PaymentIntent`, `&mut PaymentRegistry`, `Coin<T>`,
`&Clock`, `&mut TxContext`.

1. `assert!(credential.active, EMerchantInactive)`
2. `assert!(intent.credential_id == object::id(credential), ECredentialMismatch)` — the caller
   could otherwise pass a different merchant's credential
3. `assert!(intent.coin_type == type_name::with_defining_ids<T>().into_string(),
   ECoinTypeMismatch)` — a request fixes an amount *and* a currency. Payment Kit only checks
   that the coin's value matches the number, so without this any coin of equal numeric value,
   including a worthless one, would settle it
4. `assert!(clock.timestamp_ms() < intent.expiry_ms, EIntentExpired)`
5. `assert!(!intent.paid, EIntentAlreadyPaid)`
6. Read `payout = credential.payout` — **never from a parameter, never from the caller**
7. Call `payment_kit::process_registry_payment<T>(registry, intent.nonce, intent.amount, coin,
   option::some(payout), clock, ctx)` and discard the returned receipt
8. `intent.paid = true`
9. `event::emit(PaymentCompleted { ... })`, then transfer a `SuiSureReceipt` to the payer

Order matters and is load-bearing: structural mismatches (wrong merchant, wrong currency) are
caught before temporal ones (expired, already paid), so the reason shown on screen is the most
specific one available.

Error constants, all seven:

| Code | Constant |
|---|---|
| 1 | `EMerchantInactive` |
| 2 | `ECredentialMismatch` |
| 3 | `EIntentExpired` |
| 4 | `EIntentAlreadyPaid` |
| 5 | `EInvalidNonce` |
| 6 | `EInvalidExpiry` |
| 7 | `ECoinTypeMismatch` |

Five of our eight tests are failure cases, so these codes are demo content — a transaction
that fails with a legible on-screen reason is far more convincing than one that just fails.

### Payment Kit reference

Module path is `payment_kit::payment_kit` — package and module share a name.

```move
// Returns BOTH, unshared. PaymentRegistry has `key` but not `store`, so nothing outside
// payment_kit can share it — you must call payment_kit::share in the same PTB.
public fun create_registry(
    namespace: &mut Namespace,
    name: ascii::String,
    ctx: &mut TxContext
): (PaymentRegistry, RegistryAdminCap)

public fun share(registry: PaymentRegistry)

// Note the return value, and that nonce is std::ascii::String.
public fun process_registry_payment<T>(
    registry: &mut PaymentRegistry,
    nonce: ascii::String,
    payment_amount: u64,
    coin: Coin<T>,
    receiver: Option<address>,
    clock: &Clock,
    ctx: &mut TxContext
): PaymentReceipt
```

`PaymentReceipt` has `copy, drop, store` and **no `key`**, and none of its fields have public
accessors — it can be discarded but not read or given to anyone.

`payment_kit::init_for_testing(ctx)` is `#[test_only]` and shares a Namespace plus a registry,
which is how our tests run against a real registry instead of a stub.

Namespace objects:
- testnet `0xa5016862fdccba7cc576b56cc5a391eda6775200aaa03a6b3c97d512312878db`
- mainnet `0xccd3e4c7802921991cd9ce488c4ca0b51334ba75483702744242284ccf3ae7c2`

Payment Kit's duplicate prevention keys on nonce + amount + coin type + receiver, so replay
protection comes free. Keep our own `paid` flag anyway so the failure message is legible.

Its error conditions: `EDuplicatePayment`, `EPaymentAmountMismatch`.

The `payment_kit` package ID is resolved and recorded in `src/config/sui.ts` as
`paymentKitPackageId`. It was confirmed by reading the type of the testnet Namespace object
above rather than taken on trust. Read it from config; never hardcode or guess it.

**Depending on it has one sharp edge.** payment_kit's manifest declares
`payment_kit = "0x0"` and records no published address anywhere, so some tooling treats it as
unpublished. Observed on sui 1.79:

- `sui client publish` and `sui client upgrade` **resolve it correctly** to the deployed
  package. Verified on a wiped build directory: the dependency list comes back as `0x1`, `0x2`
  and `0x7e069abe..1497`, with no duplicate.
- `sui client test-publish` refuses with *"The package has unpublished dependencies"*. That is
  a limitation of that subcommand, not a problem with the package.

**Never pass `--with-unpublished-dependencies`.** It would deploy a *second copy* of
payment_kit, and our module would then be calling a package that the canonical Namespace and
`PaymentRegistry` know nothing about.

---

## Traps that will cost hours

**Nonce length.** Payment Kit caps nonces at 36 characters and wants UUIDv4. A Sui object ID
is 66 characters, so the intent's own object ID **cannot** be the nonce. Generate a separate
UUID at intent creation and store it in the `PaymentIntent`.

**Exact coin amounts.** Payment Kit rejects a coin whose value does not exactly match the
amount, and a user's coin object is almost never the right size. The frontend must
`splitCoins` first and pass the exact split in, **within the same PTB**. This is a shared
interface between Aida and Syafieqah — agree it explicitly. When it breaks it looks like the
contract is broken.

**Decimals differ per coin.** SUI has 9 (MIST). USDC has 6. The frontend currently assumes
MIST everywhere, so a USDC amount would be wrong by a factor of 1000. Whoever converts MYR to
token units must know the decimals for the coin type in play.

**Gas coin equivocation.** Two transactions submitted concurrently against the same owned gas
coin lock that object until the epoch ends. Classic demo-day failure. Run the faucet several
times so the demo wallet holds multiple separate gas coins.

**Expiry is ours.** Payment Kit's `epoch_expiration_duration` governs deleting old records,
not whether an intent is still valid. That check lives in our module.

**Two lockfiles, and the deploy uses the one CLAUDE.md does not name.** The repo carries both
`bun.lock` and `package-lock.json`. App Hosting installs with `npm ci`, which refuses to run
at all when `package.json` and `package-lock.json` disagree. A `bun add` updates `bun.lock`
only, so it breaks the deploy with `Missing: <pkg> from lock file` before the build even
starts. Until the team picks one package manager, follow every `bun add` with
`npm install --package-lock-only` and commit both lockfiles.

**Gas coins get merged back into one.** Running PTBs from the CLI consolidates the wallet's
SUI, silently undoing the multi-coin defence above. Check `sui client gas` shows several rows
before demo day, not just a healthy total.

**Reading Sui CLI output on Windows.** Piping `--json` into a script that decodes with the
locale codepage mangles UTF-8 and invents corruption that is not on chain. Decode explicitly
as UTF-8 before concluding a merchant name is broken.

---

## Decisions already made

- **Generic over `T`, demo with testnet USDC.** Payment Kit is generic so ours must be. Being
  generic is also our fallback: if the USDC faucet is unavailable on demo day we change one
  type argument in the frontend and demo in SUI, with no redeploy.
- Testnet USDC comes from `faucet.circle.com` — 20 USDC per address every 2 hours. Get the
  exact Sui testnet USDC coin type string from Circle's official Sui docs, not a forum post.
- **Demo on testnet.** Mainnet is a Friday bonus at most: publish the package and do one small
  real payment so the pitch has a mainnet digest a judge can open. The live stage demo stays
  on testnet because it is free and repeatable.

## Still open — ask before assuming

- **zkLogin or wallet connect.** `zkLogin.service.ts` correctly refuses to fabricate a proof
  and throws outside mock mode. Real zkLogin needs an OAuth client, salt service and prover —
  Enoki is the practical path. Treat as a stretch. Never describe a mock login as real zkLogin
  in the README, video, or pitch.

---

## Hackathon rules that constrain the code

- **Build and demo on testnet.** Section 9 of the rules deck lists mainnet deployment using
  real funds during the hacking period as immediate disqualification. Organizers have verbally
  indicated mainnet is permitted and is encouraging for it — do not act on that without written confirmation on record.
- **Commit history must start no earlier than 26 August 2026.** Ours starts 31 August, so we
  are clear. Commit in small, meaningful increments — "clear commit history" is a stated
  requirement and one giant dump reads badly.
- **Every AI tool used must be declared** in the submission: Lovable, the assistant model, and
  any coding assistant including this one. Misrepresented AI-generated work is immediate
  disqualification.
- **The repository must be public at submission.**
- Do not force-push, rebase, or squash pushed commits. This repo syncs to Lovable and history
  rewrites break it. See `AGENTS.md`.

---

## Legal language — keep it minimal

Crypto is legal to hold and trade in Malaysia but is not legal tender, and Bank Negara does
not recognise it as a payment instrument. Merchants accepting crypto are not protected by BNM,
which is precisely why structural safety matters here.

In any copy, the full disclosure is: **testnet prototype, non-custodial, not a licensed
entity.** Do not write anything that reads as a legal claim.

---

## Stack

TanStack Start + TanStack Router, React 19, Vite, Tailwind v4, shadcn/ui, Zod.
QR via `qrcode` and `@zxing/browser`. Package manager: bun.

Scripts: `bun run dev`, `bun run build`, `bun run lint`, `bun run format`.

Sui note: JSON-RPC is deprecated and now returns `-32601 Method not found` on **testnet**
public fullnodes as well as mainnet — confirmed directly, not just documented. Use gRPC or
GraphQL. `src/services/sui/client.ts` uses `SuiGrpcClient` from `@mysten/sui/grpc`; do not
import from `@mysten/sui/jsonRpc`. The TypeScript SDK is on v2 (`@mysten/sui@2.x`); older
tutorials will not compile.

---

## Definition of demo ready

- Public URL opens without Lovable authentication
- A real wallet or real zkLogin connects
- Merchant creates an on-chain `PaymentIntent`
- QR works from another browser or device
- Customer sees canonical Sui data
- Wallet signs a real testnet payment
- Receipt contains a **working** explorer link (currently fabricated — must be fixed)
- Replayed or tampered request is blocked
- AI command reaches the same review screen
- README contains deployed contract information

Deprioritised: account deletion, real merchant approval, Firestore, Apple/Facebook login,
real MYR conversion, push notifications, elaborate dashboards.

**A complete real payment plus one working security failure case scores far better than ten
unfinished features.**
