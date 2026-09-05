# SuiSure Demo Video Runbook

**Target length:** 3:15–3:45  
**Goal:** prove one real merchant payment from intent verification to public Sui receipt.

## Before recording

- Use the deployed Firebase URL in a clean browser profile.
- Prepare one funded Google zkLogin account and one funded extension-wallet account.
- Confirm both SUI gas and Testnet USDC balances.
- Prepare one fresh, valid payment intent and one expired intent.
- Keep the merchant dashboard open in a second tab.
- Copy the successful transaction's explorer URL after payment.
- Disable notifications, close unrelated tabs, and record at 1080p.
- Record one clean fallback take before attempting a live presentation.

## Shot list and narration

| Time | Screen | Narration / action |
| --- | --- | --- |
| 0:00–0:15 | Title card or landing page | “Crypto merchant checkout often asks users to trust an address or QR they cannot verify. SuiSure verifies first, then pays.” |
| 0:15–0:35 | Sign-in page | Show Google zkLogin and the Sui wallet option. Sign in with the pre-funded account. |
| 0:35–0:50 | Home balance | Point out the connected address, Testnet network, SUI gas, and USDC balance. |
| 0:50–1:10 | Merchant dashboard | Show a pending request and its generated QR. Explain that the QR carries object IDs, not a payout address. |
| 1:10–1:30 | Scan or upload | Scan/upload the QR. Let the app load the merchant credential and payment intent from Sui. |
| 1:30–1:55 | Payment review | Point out verified merchant, canonical amount, token, expiry, and request status. |
| 1:55–2:20 | Confirmation | Confirm the payment. Keep the animated robot visible while the transaction is prepared and finalized. |
| 2:20–2:40 | Success receipt | Show amount, merchant, payer, recipient, digest, and “View on Sui explorer.” |
| 2:40–2:55 | Sui explorer | Open the digest and show that `pay_payment_intent` succeeded on Testnet. |
| 2:55–3:10 | Merchant activity / notifications | Refresh the merchant account and show the incoming amount and payer address. |
| 3:10–3:25 | Safety proof | Open the expired intent or retry the paid intent; show the legible rejection and that nothing is sent. |
| 3:25–3:40 | AI tab, only if stable after merge | Enter a plain-language request. Explain that AI interprets and explains, while on-chain state remains authoritative and the user still confirms. |
| 3:40–3:45 | Closing title | “Before you pay, SuiSure asks: U sure or not?” |

## What the video must visibly prove

1. The connected account has real Testnet balances.
2. The merchant and request are read from Sui, not trusted from the QR.
3. The customer controls the final confirmation.
4. The transaction settles in Testnet USDC.
5. The explorer digest is real and public.
6. The merchant sees an account-scoped incoming payment.
7. Invalid, expired, or replayed requests stop safely.

## Recording rule

If the AI merge is not stable, omit the AI shot rather than weakening the payment demo. The payment flow is the proof; the AI section can be explained in the presentation until its integration passes the same end-to-end test.
