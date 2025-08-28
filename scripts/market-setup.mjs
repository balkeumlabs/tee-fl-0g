import "dotenv/config";
import { Wallet, JsonRpcProvider } from "ethers";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const brokerPkg = require("@0glabs/0g-serving-broker");
const { createZGComputeNetworkBroker } = brokerPkg;

function getArg(name, def = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const rpc = process.env.RPC_ENDPOINT || process.env.EVM_RPC;
  const pk  = process.env.PRIVATE_KEY;
  if (!rpc || !pk) {
    console.error("Missing RPC_ENDPOINT/EVM_RPC or PRIVATE_KEY in .env");
    process.exit(1);
  }

  const provider = new JsonRpcProvider(rpc);
  const signer = new Wallet(pk, provider);
  const addr = await signer.getAddress();
  console.log("wallet:", addr);

  const broker = await createZGComputeNetworkBroker(signer);

  // ===== 1) Ensure a ledger account exists & is funded (A0GI units, NOT ETH) =====
  // Docs: 'addLedger(balance)' and 'depositFund(amount)' take A0GI units. :contentReference[oaicite:1]{index=1}
  const targetA0GI = parseInt(process.env.LEDGER_A0GI || "2000000", 10); // default 2,000,000 A0GI
  console.log("Target ledger balance (A0GI):", targetA0GI);

  // Try to create/fund the ledger; SDK may not return a tx object, so we just call and then poll state.
  try {
    await broker.ledger.addLedger(targetA0GI);
    console.log("addLedger(A0GI) called");
  } catch (e) {
    console.warn("addLedger warning:", e?.message ?? e);
  }

  // Poll for ledger readiness (max ~10s)
  let ready = false;
  for (let i = 0; i < 10; i++) {
    try {
      const info = await broker.ledger.getLedger?.();
      if (info) {
        console.log("getLedger():", info);
        // If info has a 'balance' or similar, check it; otherwise assume success once object exists
        if (typeof info.balance === "number") {
          console.log("ledger balance (A0GI):", info.balance);
          if (info.balance >= targetA0GI) ready = true;
        } else {
          ready = true;
        }
        if (ready) break;
      }
    } catch (e) {
      console.log("getLedger() not ready yet:", e?.message ?? e);
    }
    await sleep(1000);
  }
  if (!ready) {
    console.warn("Ledger may not be indexed yet, continuing anyway…");
  }

  // ===== 2) Choose provider (arg or first from discovery) =====
  let providerAddr = getArg("provider");
  if (!providerAddr) {
    const svcs = await broker.inference.listService();
    if (!svcs?.length) {
      console.error("No services available to acknowledge.");
      process.exit(1);
    }
    providerAddr = svcs[0].provider;
    console.log("Using first provider:", providerAddr);
    // Log price info if present so you can size your A0GI deposit
    const s0 = svcs.find(s => s.provider === providerAddr);
    if (s0) {
      console.log("prices (A0GI): inputPrice=", s0.inputPrice?.toString?.(), "outputPrice=", s0.outputPrice?.toString?.());
    }
  }

  // ===== 3) Acknowledge provider (required once per provider) =====
  try {
    const already = await broker.inference.userAcknowledged(providerAddr);
    console.log("userAcknowledged?", !!already);
    if (!already) {
      console.log("Acknowledging provider:", providerAddr);
      await broker.inference.acknowledgeProviderSigner(providerAddr);
      console.log("acknowledged.");
    }
  } catch (e) {
    console.error("acknowledge/userAcknowledged error:", e?.message ?? e);
    process.exit(1);
  }

  // ===== 4) (Optional) Top up after creation =====
  const topUp = parseInt(process.env.LEDGER_TOPUP_A0GI || "0", 10);
  if (topUp > 0) {
    console.log("Depositing additional A0GI:", topUp);
    try {
      await broker.ledger.depositFund(topUp);
      console.log("depositFund done");
    } catch (e) {
      console.warn("depositFund error:", e?.message ?? e);
    }
  }

  // ===== 5) Show metadata and exit OK =====
  const md = await broker.inference.getServiceMetadata(providerAddr);
  console.log("metadata:", md);
  console.log("✅ Ledger ready (A0GI funded) + provider acknowledged");
}

main().catch((e) => {
  console.error("setup error:", e?.message ?? e);
  process.exit(1);
});
