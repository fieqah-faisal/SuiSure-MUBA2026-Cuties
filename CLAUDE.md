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

Frontend is substantially built — ~1,750 lines of routes, ~650 lines of service adapters, QR
generation and scanning wired in. **Everything below the UI is mocked.** `src/config/sui.ts`
has `mockMode: true`. Each service is a clean interface with a simulated body, so going live
means replacing function bodies without touching UI.

Does not exist yet:

- `move/` — the Move package. Not started.
- `functions/` — the AI backend endpoint. Not started.
- `@mysten/sui` and `@mysten/dapp-kit` — not in `package.json`. No blockchain code at all.
- Real AI. `src/services/ai-assistant/ai.service.ts` is regex matching, not a model call.
- Real transaction digests. `payment.service.ts` generates random strings, so receipt
  explorer links currently 404.

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
| `MerchantCredential` | `key` | **Shared** | `id`, `name`, `payout: address`, `active: bool` |
| `PaymentIntent` | `key` | **Shared** | `id`, `credential_id: ID`, `amount: u64`, `nonce: String`, `expiry_ms: u64`, `paid: bool` |
| `PaymentCompleted` | `copy, drop` | Event | intent ID, merchant, amount, payer |

Shared vs owned is a one-way decision. `MerchantCredential` and `PaymentIntent` must both be
shared — the customer is a different party from the merchant and must read both.

### Functions

- `init(ctx)` — runs once at publish. Mints `AdminCap` to the deployer.
- `register_merchant(_: &AdminCap, name, payout, ctx)` — shares a `MerchantCredential`.
- `create_payment_intent(&MerchantCredential, amount, nonce, expiry_ms, ctx)` — shares a
  `PaymentIntent`.
- `pay_payment_intent<T>(...)` — the one that matters.

There is no `msg.sender` modifier in Move. Requiring `&AdminCap` in the signature *is* the
access check.

### `pay_payment_intent<T>` — order of operations

Parameters: `&MerchantCredential`, `&mut PaymentIntent`, `&mut PaymentRegistry`, `Coin<T>`,
`&Clock`, `&mut TxContext`.

1. `assert!(credential.active, EMerchantInactive)`
2. `assert!(intent.credential_id == object::id(credential), ECredentialMismatch)` — the caller
   could otherwise pass a different merchant's credential
3. `assert!(clock.timestamp_ms() < intent.expiry_ms, EIntentExpired)`
4. `assert!(!intent.paid, EIntentAlreadyPaid)`
5. Read `payout = credential.payout` — **never from a parameter, never from the caller**
6. Call `payment_kit::process_registry_payment<T>(registry, intent.nonce, intent.amount, coin,
   option::some(payout), clock, ctx)`
7. `intent.paid = true`
8. `event::emit(PaymentCompleted { ... })`

Every assert gets a named error constant. Three of our five demo tests are failure cases, so
these codes become demo content — a transaction that fails with a legible on-screen reason is
far more convincing than one that just fails.

### Payment Kit reference

```move
public fun create_registry(namespace: &mut Namespace, name: String, ctx: &mut TxContext)

public fun process_registry_payment<T>(
    registry: &mut PaymentRegistry,
    nonce: String,
    payment_amount: u64,
    coin: Coin<T>,
    receiver: Option<address>,
    clock: &Clock,
    ctx: &mut TxContext
)
```

Namespace objects:
- testnet `0xa5016862fdccba7cc576b56cc5a391eda6775200aaa03a6b3c97d512312878db`
- mainnet `0xccd3e4c7802921991cd9ce488c4ca0b51334ba75483702744242284ccf3ae7c2`

Payment Kit's duplicate prevention keys on nonce + amount + coin type + receiver, so replay
protection comes free. Keep our own `paid` flag anyway so the failure message is legible.

Its error conditions: `EDuplicatePayment`, `EPaymentAmountMismatch`.

**The `payment_kit` package ID is not in this file on purpose.** Do not guess it. Resolve it
by opening the testnet Namespace object above in a Sui explorer and reading which package owns
its type, then record it in `move/Move.toml` and `src/config/sui.ts`.

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

Sui note: JSON-RPC is deprecated and was disabled on mainnet full nodes in late July 2026 —
use gRPC or GraphQL. The TypeScript SDK is on v2; older tutorials will not compile.

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
