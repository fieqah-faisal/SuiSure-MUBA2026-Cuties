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

### Package

```
0xac4bbcadef19c4687a75bda3afa31e069473e8824d43d771f7c5c36fee1dd445
```

One ID, used both for move calls and for matching object types. A struct's type is
anchored to the package version that first defined it, and every struct here is
defined in this version. If the package is ever upgraded, that splits again —
existing structs keep reporting this ID while newly added ones report the upgraded
ID — and both are then needed. `isSuiSureType` in `src/services/sui/client.ts` is
where that lives.

### On-chain objects

| Object | ID |
| --- | --- |
| PaymentRegistry (shared) | `0x3291fba65f6b24c4790727042b7198be9b0be43e3b88694a330cd4ad644e1691` |
| RegistryAdminCap | `0x51307731279cfe0c9a8d324bce95d15d48a03c20a1b6c1ba0f24fea78c96b631` |
| AdminCap | `0x86c3aa4eba5ed7a26be369546037189dfdd7bae6999dd6434c5528e592c8742f` |
| UpgradeCap | `0xd26f7d957bf698eeeff291a720df444a6090a86e9d0bd4648ae2ec9a8241d2c0` |
| Payment Kit package | `0x7e069abe383e80d32f2aec17b3793da82aabc8c2edf84abbf68dd7b719e71497` |
| Payment Kit Namespace | `0xa5016862fdccba7cc576b56cc5a391eda6775200aaa03a6b3c97d512312878db` |

The registry's `registry_managed_funds` is **false**, so payments transfer straight
from the customer's wallet to the merchant's. Funds never accumulate in the registry
and we never hold them.

### Demo merchant credentials (shared)

| Merchant | Credential | Payout |
| --- | --- | --- |
| Kopitiam Seri Damai | `0x73ffe36c370cd0e768e85f59e3c53eba557a3ccc123992d8062f2cbcc063d68f` | `0xc3eb96f569be60172e576300218274998ad23a113357055a947942247da63309` |
| Campus Café | `0xe0b13c411e139c254e8752f2bd4084d20f2767a31cca3cdeff47ad2175d234b3` | `0xa36de3707dd774f008d2e3639f310a11058201390fc2d3031c11d5215b5002dd` |

### Coin

Testnet USDC, **6 decimals** — not 9. Amounts are integers in the smallest unit.

```
0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC
```

The contract is generic over the coin type, so the same package settles in SUI by
changing one type argument. A payment request records the coin it must be settled
in, so being generic does not mean being loose about which currency arrives.

### Standing demo requests

Two unpaid payment requests, valid until **10 September 2026**, for testing without creating
one first. Both are denominated in USDC.

| Merchant | Amount | Payment intent |
| --- | --- | --- |
| Kopitiam Seri Damai | RM12.00 / 2.553191 USDC | `0x204dc2dfc0a8eabb9d7730a7e89c5d979fc686991d6579b06d6bf03eb0c57fa7` |
| Campus Café | RM8.00 / 1.702128 USDC | `0x005ecc8f3445bdbd84830a1701b681c126aa41ae8325d8946350e3746572772e` |

Paying one marks it paid permanently, and a second attempt is rejected with
`EIntentAlreadyPaid`. That is the intended behaviour, not a broken fixture — create a
replacement with `create_payment_intent<T>`.

### Verified transactions

All four are real testnet transactions and can be opened by anyone.

| | Digest | Result |
| --- | --- | --- |
| Payment succeeds | [`FhtaB57t…3oQcw`](https://suiscan.xyz/testnet/tx/FhtaB57tHhv5nrxKhQP4o1miyjhykFLYKDD6BCP3oQcw) | 2.553191 USDC delivered |
| Replayed request | [`6Fp4Rd3v…b1icP`](https://suiscan.xyz/testnet/tx/6Fp4Rd3vckbRSpyrz9rMPwer4d2jCWtFHvMyLxRb1icP) | aborts, code **4** |
| Swapped merchant credential | [`AkzDNewd…LFXXT`](https://suiscan.xyz/testnet/tx/AkzDNewdTdKko3rxB3MiZR8KYBjUcRFWHnTGqbcLFXXT) | aborts, code **2** |
| Wrong coin type | [`ABYL1hs4…U4fHr`](https://suiscan.xyz/testnet/tx/ABYL1hs4ThwTsYsWr7qZ613t4gp8oCni3qebUPVU4fHr) | aborts, code **7** |

**The payment** sends 2.553191 USDC for an RM12.00 order. It arrives at Kopitiam's
payout address, which was never submitted with the transaction — the contract read
it from the merchant credential. The customer is left holding a `SuiSureReceipt`
object.

**The replay** submits the same, already-paid request a second time.

**The swapped credential** is the sticker-swap attack: an unpaid request belonging to
Kopitiam, paid while presenting Campus Café's credential, expecting the funds to
follow the substituted merchant.

**The wrong coin type** pays a USDC request with SUI of the same numeric value.
Payment Kit checks that a coin's *value* matches the requested amount but never
checks its *type*, so without this the request could have been settled in any token
at all — including one minted for free.

All three failures abort inside `pay_payment_intent` at different instruction
offsets, so they are demonstrably different checks firing rather than one generic
rejection.

### Error codes

| Code | Constant | Meaning |
| --- | --- | --- |
| 1 | `EMerchantInactive` | Merchant credential is switched off |
| 2 | `ECredentialMismatch` | Credential is not the one the request was created against |
| 3 | `EIntentExpired` | Request is past its expiry |
| 4 | `EIntentAlreadyPaid` | Request has already been paid |
| 5 | `EInvalidNonce` | Nonce is empty or over 36 characters |
| 6 | `EInvalidExpiry` | Expiry is not in the future |
| 7 | `ECoinTypeMismatch` | Coin offered is not the coin the request was created for |

### Building

```bash
cd move
sui move build
sui move test
```

Eight tests, five of them failure cases.
