# SuiSure - MUBA Blockchain Hackathon 2026
### **SuiSure: U SURE OR NOT???**

## **THE PROBLEM**
Around **559 million people worldwide** hold cryptocurrency as of 2026.

Yet, Crypto payments remain difficult for ordinary users because they must understand:
- Wallets and addresses
- Networks
- Tokens and Stablecoins
- Gas fees
- Long hexadecimal recipient addressses

and the list goes on...

At the same time, physical merchant QR codes can be:
- Covered with an attacker's QR sticker
- Replaced with a different recipient
- Modified to request a different amount
- Used to redirect users to phishing websites
- Copied or replayed

**SO, how are we solving these problems?**

### Meet **SuiSure**

Our product aims to make:
1. Blockchain payments understandable with one sentence of "Hey, send RM12 to Kopitiam in USDC"
2. Verify the merchant and transaction before payment

**SuiSure**

**Before you pay, WE ask, "U sure or not??"**

---

## Deployment — Sui Testnet

Testnet prototype. Non-custodial. Not a licensed entity.

The Move package is `suisure::payments`. It wraps [Sui Payment Kit](https://github.com/MystenLabs/sui-payment-kit):
Payment Kit moves the funds, and this package supplies the recipient address by
reading it from the merchant's on-chain credential rather than accepting it from
the caller.

### Package IDs

Two IDs, and they are **not interchangeable**.

| | ID |
| --- | --- |
| Latest — use for move calls | `0x428e043100e7c4e6a0efed67a7b49f1537bd7bc25a58f6294832de7eda63713b` |
| Original — use for type identity | `0x0a855f30c0979bad86c200847ea61c6befafde3a4769d771c539a4031e980a00` |

The package was published at the original ID and later upgraded, which changes the
ID used to call functions. Type identity stays anchored to the original, so every
object reports its type as `0x0a855f30…::payments::MerchantCredential` regardless of
which version created it. Query object types and filter events on the original ID;
send transactions to the latest. Using the latest ID for a type query returns
nothing, silently.

### On-chain objects

| Object | ID |
| --- | --- |
| PaymentRegistry (shared) | `0x3291fba65f6b24c4790727042b7198be9b0be43e3b88694a330cd4ad644e1691` |
| RegistryAdminCap | `0x51307731279cfe0c9a8d324bce95d15d48a03c20a1b6c1ba0f24fea78c96b631` |
| AdminCap | `0x2bf633f877f078e014a82940374242ddde81e23e4d42c657550c0096cb546264` |
| Payment Kit package | `0x7e069abe383e80d32f2aec17b3793da82aabc8c2edf84abbf68dd7b719e71497` |
| Payment Kit Namespace | `0xa5016862fdccba7cc576b56cc5a391eda6775200aaa03a6b3c97d512312878db` |

The registry's `registry_managed_funds` is **false**, so payments transfer straight
from the customer's wallet to the merchant's. Funds never accumulate in the registry
and we never hold them.

### Demo merchant credentials (shared)

| Merchant | Credential | Payout |
| --- | --- | --- |
| Kopitiam Seri Damai | `0x62152dd75cc21378c319741d75e114134fa2c7084c1e34bd6b75ff52bad338e0` | `0xc3eb96f569be60172e576300218274998ad23a113357055a947942247da63309` |
| Campus Café | `0xf8ed47fba2d595be870747c23f5684db8787d432372e3bed7d8ebd69fd2ef21a` | `0xa36de3707dd774f008d2e3639f310a11058201390fc2d3031c11d5215b5002dd` |

### Coin

Testnet USDC, **6 decimals** — not 9. Amounts are integers in the smallest unit.

```
0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC
```

The contract is generic over the coin type, so the same package settles in SUI by
changing one type argument.

### Verified transactions

All three are real testnet transactions and can be opened by anyone.

**A payment that succeeds** — 2.553191 USDC for an RM12.00 order.

[`73FoxwgHirmKuDNcCWv4dmVcvNTimZW6ah42tYJ6wtit`](https://suiscan.xyz/testnet/tx/73FoxwgHirmKuDNcCWv4dmVcvNTimZW6ah42tYJ6wtit)

The USDC arrives at Kopitiam's payout address. That address was never submitted with
the transaction — the contract read it from the merchant credential. The customer is
left holding a `SuiSureReceipt` object.

**A replayed request, blocked** — the same paid request, submitted again.

[`5gbWuBDZ1fDVoZ2A9H1e1LHJ1dAydTx84mpCTu4YJafM`](https://suiscan.xyz/testnet/tx/5gbWuBDZ1fDVoZ2A9H1e1LHJ1dAydTx84mpCTu4YJafM) — aborts with code **4**, `EIntentAlreadyPaid`.

**A swapped merchant credential, blocked** — an unpaid request belonging to Kopitiam,
paid while presenting Campus Café's credential. This is the sticker-swap attack: the
attacker substitutes a merchant, expecting the funds to follow.

[`CZzfnHeagToSfHnAcXFNJccrX2sJ2KCkPA4AMKVk6zgN`](https://suiscan.xyz/testnet/tx/CZzfnHeagToSfHnAcXFNJccrX2sJ2KCkPA4AMKVk6zgN) — aborts with code **2**, `ECredentialMismatch`.

### Error codes

| Code | Constant | Meaning |
| --- | --- | --- |
| 1 | `EMerchantInactive` | Merchant credential is switched off |
| 2 | `ECredentialMismatch` | Credential is not the one the request was created against |
| 3 | `EIntentExpired` | Request is past its expiry |
| 4 | `EIntentAlreadyPaid` | Request has already been paid |
| 5 | `EInvalidNonce` | Nonce is empty or over 36 characters |
| 6 | `EInvalidExpiry` | Expiry is not in the future |

### Building

```bash
cd move
sui move build
sui move test
```

Seven tests, four of them failure cases.
