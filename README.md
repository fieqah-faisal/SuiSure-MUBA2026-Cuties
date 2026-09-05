# SuiSure — MUBA Blockchain Hackathon 2026

### **SuiSure: U SURE OR NOT???**

> SuiSure is an AI-assisted merchant payment application that verifies the merchant, amount, token, expiry, and replay status on Sui before a customer confirms payment.

**Tracks:** Track 1 — Payments & Stablecoins & Track 2 — AI × Sui  
**Network:** Sui Testnet  
**Live application:** https://suisure--suisure-cuties.asia-southeast1.hosted.app  
**Demo video:** _Add Devfolio video link_

---

## 1. Project overview

SuiSure makes crypto merchant payments feel like a familiar QR checkout while adding verification that a normal wallet-address QR cannot provide.

A merchant uses an on-chain credential and creates an on-chain payment request. The customer scans the QR, uploads it, or describes the intended payment in plain language. Before anything can be paid, SuiSure reads the canonical merchant and request data from Sui and presents it for confirmation.

The result is a non-custodial payment: Testnet USDC moves directly from the customer to the merchant, and the customer receives an on-chain receipt.

SuiSure borrows the familiar experience of merchant QR payments; it does **not** integrate with or replace DuitNow.

## 2. Problem statement

Crypto merchant checkout often asks customers to trust a wallet address or QR payload they cannot meaningfully verify. Because blockchain settlement is irreversible, several failures can cause permanent loss:

- a merchant QR can be replaced with an attacker's QR;
- a long hexadecimal recipient address is difficult for users to verify;
- a previously paid request can be replayed;
- an expired request may still appear valid;
- an amount-only payment check may accept the wrong token;
- client or AI-provided data may disagree with the actual on-chain request.

The important moment is therefore **before signing**. The customer needs a clear way to confirm who will receive the payment, what is being paid, which token is required, and whether the request is still valid.

## 3. Proposed solution and how it works

The proposed solution is the overall idea: **bind merchant checkout details to verifiable Sui objects instead of trusting the QR itself**.

The following flow explains how that solution operates:

1. **Register merchant** — an administrator issues a shared `MerchantCredential` containing the merchant name, category, payout address, and active status.
2. **Create payment request** — a `PaymentIntent` records the merchant credential, USDC amount, MYR display amount, description, order reference, coin type, nonce, and expiry.
3. **Generate QR** — the QR carries the payment-intent ID and merchant-credential ID. It never carries a destination address.
4. **Scan, upload, or ask** — the customer opens the request through QR scanning, image upload, or plain-language assistance.
5. **Verify on Sui** — SuiSure reads the shared objects and checks the merchant, amount, token, expiry, and payment status.
6. **Review and confirm** — the customer confirms with Google zkLogin or a compatible Sui wallet.
7. **Settle and prove** — Sui Payment Kit transfers Testnet USDC directly to the registered merchant. The payer receives a `SuiSureReceipt`, and a `PaymentCompleted` event is emitted.

### Key features

- Google zkLogin and Sui Wallet Standard authentication
- QR scanning, QR image upload, and plain-language payment assistance
- On-chain merchant and payment-request verification
- Direct wallet-to-wallet Testnet USDC settlement
- Expiry, replay, merchant-substitution, and wrong-token protection
- Customer receipts and Sui explorer links
- Account-scoped payment activity and notifications
- Merchant payment-request dashboard with QR generation and status updates

> **AI safety boundary:** AI may interpret and explain a payment, but it cannot provide the trusted payout address, override on-chain values, sign, approve, or submit a transaction. Sui remains the source of truth, and the user makes the final payment decision.

## 4. Architecture, Sui integration, and track alignment

### Architecture Diagram

<img width="1272" height="732" alt="SuiSure_Architecture_Diagram drawio" src="https://github.com/user-attachments/assets/f79cdb86-6d87-4c95-bbbc-1918d17fe46d" />


### Why Sui is integral

Sui is the trust and settlement layer, not an optional database. Shared objects allow a customer to read merchant credentials and requests created by another party. Move enforces all payment rules atomically. Events and owned receipt objects provide independently verifiable payment outcomes.

**Sui Payment Kit is the cashier; `suisure::payments` is the security guard.** Payment Kit performs the transfer and duplicate-payment protection. SuiSure adds verified merchant identity, canonical payout resolution, token binding, expiry enforcement, readable rejection reasons, and a customer-owned receipt.

| Track | Alignment |
| --- | --- |
| **Track 1 — Payments & Stablecoins** | Real wallet-to-wallet Testnet USDC checkout using Sui Payment Kit, expiring payment requests, replay protection, merchant verification, and receipts. |
| **Track 2 — AI × Sui** | AI helps users express and understand a payment, while verified Sui objects remain authoritative and the user retains signing control. |

### Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TanStack Start/Router, TypeScript, Vite, Tailwind CSS |
| Sui integration | `@mysten/sui` v2 gRPC, `@mysten/dapp-kit-react` |
| Authentication | Enoki Google zkLogin, Sui Wallet Standard |
| Smart contracts | Sui Move 2024, `suisure::payments` |
| Payment settlement | Sui Payment Kit, Circle Testnet USDC |
| QR functionality | `qrcode`, ZXing browser scanner |
| Deployment | Firebase App Hosting |

## 5. Smart contracts and Testnet deployment

The `suisure::payments` Move package adds merchant-specific safety checks in front of Sui Payment Kit.

During `pay_payment_intent<T>`, the contract:

1. confirms the merchant credential is active;
2. confirms the intent belongs to that credential;
3. confirms the supplied coin type matches the request;
4. rejects expired requests;
5. rejects requests that have already been paid;
6. reads the payout address from the credential—not from the QR or caller;
7. calls `payment_kit::process_registry_payment<T>`;
8. marks the request paid and creates the event and customer receipt.

### Deployed Sui Testnet resources

| Resource | Object or package ID |
| --- | --- |
| SuiSure package | `0xac4bbcadef19c4687a75bda3afa31e069473e8824d43d771f7c5c36fee1dd445` |
| PaymentRegistry | `0x3291fba65f6b24c4790727042b7198be9b0be43e3b88694a330cd4ad644e1691` |
| Payment Kit package | `0x7e069abe383e80d32f2aec17b3793da82aabc8c2edf84abbf68dd7b719e71497` |
| Payment Kit Namespace | `0xa5016862fdccba7cc576b56cc5a391eda6775200aaa03a6b3c97d512312878db` |
| Testnet USDC coin type | `0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC` |

Administrative capability IDs are intentionally omitted from this public summary. The deployed configuration is maintained in `src/config/sui.ts`.

### Public Testnet evidence

| Scenario | Transaction | Result |
| --- | --- | --- |
| Successful payment | [`FhtaB57t…3oQcw`](https://suiscan.xyz/testnet/tx/FhtaB57tHhv5nrxKhQP4o1miyjhykFLYKDD6BCP3oQcw) | 2.553191 USDC delivered |
| Replayed request | [`6Fp4Rd3v…b1icP`](https://suiscan.xyz/testnet/tx/6Fp4Rd3vckbRSpyrz9rMPwer4d2jCWtFHvMyLxRb1icP) | Rejected as already paid |
| Swapped merchant credential | [`AkzDNewd…LFXXT`](https://suiscan.xyz/testnet/tx/AkzDNewdTdKko3rxB3MiZR8KYBjUcRFWHnTGqbcLFXXT) | Rejected as credential mismatch |
| Wrong coin type | [`ABYL1hs4…U4fHr`](https://suiscan.xyz/testnet/tx/ABYL1hs4ThwTsYsWr7qZ613t4gp8oCni3qebUPVU4fHr) | Rejected as coin-type mismatch |

## 6. Setup and testing

The live application can be used directly from the link at the top of this README.

### Local installation

Requirements:

- Node.js 22 or newer
- npm
- Sui CLI for Move development and testing
- a Sui Testnet wallet with SUI for gas and Testnet USDC for payments

```bash
git clone https://github.com/fieqah-faisal/SuiSure-MUBA2026-Cuties.git
cd SuiSure-MUBA2026-Cuties
npm install
npm run dev
```

Local Google zkLogin development additionally requires an Enoki project and Google OAuth public configuration. The deployed website already has its hosting configuration.

Production build and preview:

```bash
npm run build
npm run preview
```

Validation commands:

```bash
npm run lint
npm run build

cd move
sui move build
sui move test
```

The Move package contains eight tests, including five expected-failure cases. The end-to-end flow has also been tested with Google zkLogin and extension-wallet accounts across valid, expired, replayed, and rejected payment requests.

## 7. Current limitations and future integrations

### Current limitations

- Sui Testnet prototype; it is not a licensed real-money payment service.
- Merchant credentials are currently administrator-issued.
- Testnet USDC/MYR display conversion is demo configuration rather than a live foreign-exchange quote.
- Google is the current zkLogin social provider.
- The AI layer assists payment understanding but does not authorize payment.

### Future integrations

- merchant self-service application and administrator approval;
- additional zkLogin identity providers;
- production-grade pricing or oracle integration;
- additional stablecoins and merchant settlement preferences;
- refunds, richer receipts, and merchant reconciliation;
- multilingual AI assistance under the same deterministic safety boundary.

## 8. Team members and responsibilities

| Team member | Responsibility |
| --- | --- |
| **Aida** | Move contract, Sui Payment Kit integration, Testnet deployment, and Sui transaction adapter |
| **Aidan** | AI endpoint, structured intent output, merchant resolution, and validation |
| **Syafieqah** | Wallet and zkLogin integration, live Sui frontend flows, QR/review/receipt UI, Firebase deployment, and release coordination |

---

**Before you pay, SuiSure asks: “U sure or not?”**

_Made in MUBA Blockchain Hackathon 2026_
_@ Asia Pacific University of Technology and Innovation_
