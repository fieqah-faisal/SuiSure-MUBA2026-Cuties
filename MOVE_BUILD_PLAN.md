# Move build plan — Member 1

Read `CLAUDE.md` first. This is the execution sequence for the `move/` package and the Sui
adapter. Work through it in order; each step has an acceptance check that must pass before
moving on.

**Rule for the agent: never invent an object ID, package ID, or coin type string.** If one is
needed and not recorded in `src/config/sui.ts`, stop and ask.

> ## Status: steps 0–6 are DONE. Start at step 7.
>
> The contract is published to testnet, 8 unit tests pass, both demo merchants are
> registered, the Payment Kit registry exists, and four transaction digests are recorded in
> the README — one successful payment and three rejections.
>
> **Do not re-run steps 0–6.** Republishing changes the package ID and orphans the registered
> merchant credentials, breaking every ID in `src/config/sui.ts` and the README.
>
> Steps 0–6 below are kept as a record of how the current deployment was produced. The live
> values are in `src/config/sui.ts`, which is the source of truth — not the examples here.

---

## Step 0 — Environment

```bash
curl -sSfL https://raw.githubusercontent.com/MystenLabs/suiup/main/install.sh | sh
suiup install sui@testnet
sui --version
```

Then configure the client and fund it:

```bash
sui client new-env --alias testnet --rpc https://fullnode.testnet.sui.io:443
sui client switch --env testnet
sui client active-address
sui client faucet          # run 3–4 times, spaced out
sui client gas
```

**Acceptance:** `sui client gas` lists **several separate coin objects**, not one. Multiple gas
coins are the defence against equivocation locking on demo day, and the faucet is rate-limited
so this cannot be fixed on Friday night.

Also claim testnet USDC from `faucet.circle.com` (20 per address per 2 hours) for both the
customer and merchant demo wallets.

---

## Step 1 — Resolve the Payment Kit package ID

Open this testnet Namespace object in a Sui explorer:

```
0xa5016862fdccba7cc576b56cc5a391eda6775200aaa03a6b3c97d512312878db
```

Read which package owns its type. That is the `payment_kit` package ID.

Do the same for the Sui testnet USDC coin type — take it from Circle's official Sui
documentation, not a forum post.

**Acceptance:** both strings written into `src/config/sui.ts` and committed. Everything after
this depends on them.

---

## Step 2 — Create the Payment Kit registry

Call `create_registry(namespace, name, ctx)` against the Namespace object, using a name like
`suisure-testnet`.

Record the resulting `PaymentRegistry` object ID and `RegistryAdminCap` object ID.

Then confirm `registry_managed_funds` is **false**. If true, payments accumulate inside the
registry instead of reaching the merchant, which makes us custodial and breaks the
non-custodial claim in the pitch. Fix with `set_config_registry_managed_funds` if needed.

**Acceptance:** registry ID and admin cap ID in `src/config/sui.ts`, `registry_managed_funds`
confirmed false.

---

## Step 3 — Skeleton package, published early

Do **not** write the full contract first. Both teammates are blocked until a real package ID
exists, so ship the smallest thing that unblocks them.

Create `move/` with module `suisure::payments` containing only:

- `AdminCap has key, store`, minted to the deployer in `init`
- `MerchantCredential has key`, shared via `transfer::share_object`, fields: `name: String`,
  `category: String`, `payout: address`, `active: bool`
- `register_merchant(_: &AdminCap, name, category, payout, ctx)`

Add one Move unit test that registers a merchant and asserts the credential fields.

```bash
sui move build
sui move test
sui client publish --gas-budget 100000000
```

Pull the **package ID** and the **AdminCap object ID** out of the publish output.

Then register two demo merchants and record their credential object IDs.

**Acceptance:** package ID, AdminCap ID and two merchant credential IDs all in
`src/config/sui.ts`, committed, and posted in the team chat. This is the critical-path handoff
— do it before building anything else.

---

## Step 4 — Full contract

Add to the same module:

- `PaymentIntent has key`, shared. Fields: `credential_id: ID`, `amount: u64`,
  `amount_myr: u64`, `coin_type: ascii::String`, `nonce: ascii::String`,
  `description: String`, `order_ref: String`, `expiry_ms: u64`, `created_at_ms: u64`,
  `paid: bool`
- `PaymentCompleted has copy, drop` event
- `SuiSureReceipt has key, store`, transferred to the payer
- `create_payment_intent<T>(&MerchantCredential, amount, amount_myr, nonce, description,
  order_ref, expiry_ms, &Clock, ctx)` — **generic**, so the request records the coin type it
  must be settled in
- `set_merchant_active(_: &AdminCap, credential: &mut MerchantCredential, active: bool)`
- `pay_payment_intent<T>(...)` — generic over the coin type

`nonce` and `coin_type` are `std::ascii::String`, not `std::string::String`. Payment Kit's
nonce parameter is ASCII and the two types do not interchange.

### Why `PaymentIntent` carries display fields

`PaymentIntent` in `src/types/domain.ts` needs `amountMyr`, `description`, `orderReference`
and `createdAt`. The five-field struct has no source for any of them, so they would have to
arrive from somewhere off chain — meaning the review screen would show the customer
unverified data while presenting it as canonical Sui state. That is the exact failure this
product exists to prevent, so they live on chain instead.

`amount_myr` is **integer sen**, because Move has no floats: RM12.50 is `1250`. It is a
display value only. The figure actually enforced at payment time is `amount`, in the coin's
smallest unit.

`created_at_ms` is why `create_payment_intent` also takes `&Clock`.

`category` is on `MerchantCredential` for the same reason — both `VerifiedMerchant` and
`MerchantCredential` in the frontend need it. `logoInitials` deliberately stays off chain and
is derived from the merchant name.

Adding a field is cheap now and costs a republish later, so this is the moment to get it
right.

### Why `set_merchant_active` exists

It is a real admin requirement on its own — a merchant that stops trading or turns out to be
fraudulent has to be switchable off without republishing the package. It is also the only way
Step 5 can produce an inactive credential to test `EMerchantInactive` against.

Error constants:

```move
const EMerchantInactive: u64 = 1;
const ECredentialMismatch: u64 = 2;
const EIntentExpired: u64 = 3;
const EIntentAlreadyPaid: u64 = 4;
const EInvalidNonce: u64 = 5;
const EInvalidExpiry: u64 = 6;
const ECoinTypeMismatch: u64 = 7;
```

`pay_payment_intent<T>` takes `&MerchantCredential`, `&mut PaymentIntent`,
`&mut PaymentRegistry`, `Coin<T>`, `&Clock`, `&mut TxContext` and runs, in this order:

1. assert credential active
2. assert `intent.credential_id == object::id(credential)`
3. assert not expired against `clock.timestamp_ms()`
4. assert not already paid
5. read `payout` from the credential — never from a parameter
6. call `payment_kit::process_registry_payment<T>` with `option::some(payout)` as receiver, and
   the intent's stored `nonce` and `amount`
7. set `paid = true`
8. emit `PaymentCompleted`

Add `payment_kit` as a dependency in `move/Move.toml` using the package ID from Step 1.

**Acceptance:** `sui move build` passes.

---

## Step 5 — Tests, including the failure cases

Most of the demo cases are failures, so they must be unit tests, not things discovered
live on Saturday.

Write Move unit tests covering:

1. Happy path — valid payment succeeds, `paid` flips, funds reach the merchant payout
2. `EMerchantInactive` — inactive credential is rejected (deactivate it first with
   `set_merchant_active`)
3. `EIntentExpired` — expired intent is rejected (advance the test clock)
4. `EIntentAlreadyPaid` — paying twice is rejected
5. `ECredentialMismatch` — passing a different merchant's credential is rejected
6. `ECoinTypeMismatch` — paying with a coin type the request was not created for
7. The payer owns a `SuiSureReceipt` afterwards

Use `#[expected_failure(abort_code = ...)]` for the failure cases.

Tests run against a **real** Payment Kit registry, not a stub: `payment_kit::init_for_testing`
shares a Namespace and registry inside the scenario. Every test needs one, because
`pay_payment_intent` takes `&mut PaymentRegistry` in its signature even when it aborts on the
first assert.

**Acceptance:** `sui move test` passes. Currently 8 tests, five of them failure cases.

---

## Step 6 — Republish and re-hand-off

```bash
sui client publish --gas-budget 100000000
```

The package ID **changes** on republish. Update `src/config/sui.ts`, re-register the two demo
merchants against the new package, and post the new IDs in the team chat. Anything referencing
the old package ID is now broken.

**Acceptance:** one real end-to-end payment executed from the CLI against testnet, and the
transaction digest recorded.

---

## Step 7 — TypeScript adapter

Owned files: `src/services/sui/**` and `src/config/sui.ts`.

Install `@mysten/sui` (v2 — the SDK went v1 → v2, older tutorials will not compile). Note
JSON-RPC is deprecated; use gRPC or GraphQL.

Expose functions the existing `paymentService` and `merchantService` adapters can call. The
frontend already defines these method shapes — match them rather than inventing new ones:

- `paymentService`: `encodeQrPayload`, `decodeQrPayload`, `getPaymentIntent`,
  `listMerchantIntents`, `createPaymentIntent`, `verifyPaymentIntent`, `payPaymentIntent`,
  `getReceipt`, `listReceipts`, `getBalance`
- `merchantService`: `getMerchantCredential`, `listVerifiedMerchants`, `getMerchant`,
  `submitApplication`

Do not change `paymentIntentQrPayloadSchema`. It already carries only `paymentIntentId` and
`merchantObjectId`, which is the core security property.

### The PTB contract with Syafieqah

The payment is one programmable transaction block:

1. `splitCoins(coin, [exactAmount])` — Payment Kit rejects any coin whose value does not
   exactly match
2. `moveCall` to `pay_payment_intent<T>` passing the split coin

Argument order, verified against a real testnet payment:

```
pay_payment_intent<T>(credential, intent, registry, coin, clock)
```

`clock` is the shared `0x6`. `T` must be the same coin type the intent was created with, or it
aborts with `ECoinTypeMismatch` (7). The equivalent CLI call, which is known to work:

```bash
sui client ptb --split-coins @<coin> "[<exactAmount>]" --assign split --move-call <packageId>::payments::pay_payment_intent "<<coinType>>" @<credential> @<intent> @<registry> split.0 @0x6 --gas-budget 300000000
```

Amounts are integers in the coin's smallest unit — SUI has 9 decimals, USDC has 6, confirmed
from on-chain coin metadata. Do not assume MIST. `amount_myr` is separate and is integer sen.

**Acceptance:** a real testnet payment completes from the UI with a working explorer link.

**Do not use `mockMode` as the switch.** It is only read by `zkLogin.service.ts` and
`login.tsx`. `payment.service.ts` and `merchant.service.ts` never check it and return `MOCK_`
data unconditionally, so setting it to false breaks login and changes nothing about payments.
Going live means replacing those function bodies with calls into `src/services/sui/`.

---

## Handoff checklist

Everything below goes in `src/config/sui.ts` and the team chat:

- [x] `payment_kit` package ID
- [x] Sui testnet USDC coin type string, and its **6** decimals
- [x] `PaymentRegistry` object ID
- [x] `RegistryAdminCap` object ID
- [x] `suisure::payments` package ID
- [x] `AdminCap` object ID
- [x] Two demo merchant credential object IDs
- [x] Exact `pay_payment_intent<T>` signature for the PTB
- [x] A sample transaction digest proving the flow works

All of them are in `src/config/sui.ts`. Read them from there rather than from chat history —
the package was republished once, so any ID posted before that is dead.

---

## Commit discipline

Small, meaningful commits on a branch (`aida/move-contract`), not one large dump. Never
force-push, rebase, or squash anything already pushed — it breaks the Lovable sync.

Suggested commits: Move.toml and skeleton → register_merchant + test → PaymentIntent struct →
pay_payment_intent → failure tests → adapter.
