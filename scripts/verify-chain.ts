/**
 * Chain health check.
 *
 *   npm run verify:chain
 *   npm run verify:chain -- 0x<some-other-payer-address>
 *
 * Reads everything recorded in src/config/sui.ts back off Sui Testnet and
 * confirms it is really there and really in the state we claim. The last check
 * builds a real payment and simulates it, which exercises the entire path --
 * config, gRPC, both shared objects, the split, and the Move call -- without
 * spending anything or consuming a demo request.
 *
 * Exits non-zero if any critical check fails, so it can gate a deploy.
 */
import { SUI_CONFIG } from "../src/config/sui";
import { suiClient, fetchObjectJson } from "../src/services/sui/client";
import {
  getOnChainPaymentIntent,
  resolvePaymentIntent,
  verifyAgainstChain,
} from "../src/services/sui/intents";
import { listOnChainMerchants } from "../src/services/sui/merchants";
import { buildPaymentTransaction, listPayerCoins, getPayerBalance } from "../src/services/sui/pay";

/** The wallet that holds the AdminCap and the demo funds. */
const DEFAULT_PAYER = "0xbf1b6074ee288c91a4cd8a599234547b9c1cbc73907739feff6985a86893a331";
const payer = process.argv[2] ?? DEFAULT_PAYER;

let failures = 0;
let warnings = 0;

const pass = (label: string, detail = "") => console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ""}`);
const fail = (label: string, detail: string) => {
  failures += 1;
  console.log(`  ✗ ${label} — ${detail}`);
};
const warn = (label: string, detail: string) => {
  warnings += 1;
  console.log(`  ! ${label} — ${detail}`);
};
const heading = (text: string) => console.log(`\n${text}`);

const main = async () => {
  console.log("SuiSure chain health check");
  console.log(`network ${SUI_CONFIG.network}  ·  payer ${payer.slice(0, 10)}…${payer.slice(-6)}`);

  // ---------------------------------------------------------------- node
  heading("Node");
  try {
    const { chainIdentifier } = await suiClient.core.getChainIdentifier();
    pass("gRPC reachable", `chain ${chainIdentifier}`);
  } catch (error) {
    fail("gRPC unreachable", (error as Error).message);
    console.log("\nCannot continue without a node. Stopping.");
    process.exit(1);
  }

  // ------------------------------------------------------------- package
  heading("Package");
  const pkg = await suiClient.core
    .getObjects({ objectIds: [SUI_CONFIG.packageId], include: {} })
    .then((r) => r.objects[0])
    .catch(() => undefined);
  if (pkg && !(pkg instanceof Error)) {
    pass("suisure::payments published", SUI_CONFIG.packageId.slice(0, 12) + "…");
  } else {
    fail("package not found", `${SUI_CONFIG.packageId} does not resolve`);
  }

  // ------------------------------------------------------------ registry
  heading("Payment Kit registry");
  const registry = await fetchObjectJson<{ config: { contents: unknown[] } }>(SUI_CONFIG.registryId);
  if (!registry) {
    fail("registry not found", SUI_CONFIG.registryId);
  } else {
    pass("registry exists");
    // An absent registry_managed_funds key means false, which is what keeps us
    // non-custodial. If this ever becomes true, funds accumulate in the
    // registry instead of reaching the merchant.
    const entries = registry.json.config?.contents ?? [];
    const managed = JSON.stringify(entries).includes("registry_managed_funds");
    if (!managed) {
      pass("registry_managed_funds is false", "payments go wallet to wallet");
    } else {
      fail(
        "registry_managed_funds may be set",
        "inspect it: true would make us custodial and break the pitch",
      );
    }
  }

  // ------------------------------------------------------------ merchants
  heading("Merchants");
  const merchants = await listOnChainMerchants();
  if (merchants.length !== SUI_CONFIG.merchantCredentialIds.length) {
    fail(
      "merchant count",
      `config lists ${SUI_CONFIG.merchantCredentialIds.length}, chain returned ${merchants.length}`,
    );
  }
  for (const merchant of merchants) {
    if (merchant.active) {
      pass(merchant.name, `pays ${merchant.address.slice(0, 10)}…`);
    } else {
      fail(merchant.name, "credential is INACTIVE; payments to it will abort with code 1");
    }
  }

  // -------------------------------------------------------------- intents
  heading("Standing payment requests");
  const usable: string[] = [];
  for (const intentId of SUI_CONFIG.demoIntentIds) {
    try {
      const checks = await verifyAgainstChain(intentId);
      const label = intentId.slice(0, 10) + "…";
      if (checks.notAlreadyPaid && checks.notExpired) {
        // Reading credential_id first, then resolving against it, exercises the
        // same two-step the UI does: never trust one object for both.
        const raw = await getOnChainPaymentIntent(intentId);
        const intent = await resolvePaymentIntent(intentId, raw!.credential_id);
        pass(
          `${label} payable`,
          `${intent.merchantName} · RM${intent.amountMyr} · expires ${intent.expiresAt.slice(0, 10)}`,
        );
        usable.push(intentId);
      } else if (!checks.notAlreadyPaid) {
        warn(`${label} already paid`, "expected if someone demoed it; create a replacement");
      } else {
        warn(`${label} expired`, "create a replacement with create_payment_intent<T>");
      }
    } catch (error) {
      fail(intentId.slice(0, 10) + "…", (error as Error).message);
    }
  }

  // --------------------------------------------------------------- wallet
  heading("Demo wallet");
  const sui = await listPayerCoins(payer, "0x2::sui::SUI");
  if (sui.length === 0) {
    fail("no SUI", "cannot pay gas; run the faucet");
  } else if (sui.length === 1) {
    warn(
      "only 1 gas coin",
      "two concurrent transactions would lock it until the epoch ends; run the faucet a few times",
    );
  } else {
    pass(`${sui.length} separate gas coins`, "safe against equivocation");
  }

  const usdc = await getPayerBalance(payer, SUI_CONFIG.usdcCoinType);
  const readable = (Number(usdc) / 10 ** SUI_CONFIG.usdcDecimals).toFixed(2);
  if (usdc === 0n) {
    warn("no USDC", "top up at faucet.circle.com before demoing");
  } else {
    pass(`${readable} USDC`);
  }

  // ------------------------------------------------------- full path test
  heading("End-to-end payment path");
  const target = usable[0];
  if (!target) {
    warn("skipped", "no payable request to simulate against");
  } else {
    try {
      const raw = await getOnChainPaymentIntent(target);
      const coins = await listPayerCoins(payer, SUI_CONFIG.usdcCoinType);
      const tx = buildPaymentTransaction({
        paymentIntentId: target,
        merchantCredentialId: raw!.credential_id,
        amountBaseUnits: BigInt(raw!.amount),
        coinType: SUI_CONFIG.usdcCoinType,
        paymentCoins: coins,
      });
      tx.setSender(payer);
      const bytes = await tx.build({ client: suiClient });
      const sim = await suiClient.core.simulateTransaction({ transaction: bytes });
      // The response is a discriminated union keyed by `$kind`; the effects sit
      // under the variant name, not under a generic `effects` field.
      const status = (sim as unknown as { Transaction?: { status?: { success?: boolean; error?: unknown } } })
        .Transaction?.status;
      if (status?.success) {
        pass("payment simulates successfully", "nothing was spent");
      } else {
        fail(
          "payment simulation failed",
          JSON.stringify(status?.error ?? status ?? "no status returned"),
        );
      }
    } catch (error) {
      fail("could not build or simulate a payment", (error as Error).message);
    }
  }

  // --------------------------------------------------------------- result
  console.log("");
  if (failures > 0) {
    console.log(`FAILED — ${failures} critical, ${warnings} warning(s).`);
    process.exit(1);
  }
  console.log(
    warnings > 0
      ? `OK with ${warnings} warning(s). Nothing is broken, but read them before demoing.`
      : "OK — the chain layer is healthy.",
  );
};

main().catch((error) => {
  console.error("\nHealth check crashed:", error);
  process.exit(1);
});
