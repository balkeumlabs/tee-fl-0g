import "dotenv/config";
import { JsonRpcProvider, Wallet, formatEther } from "ethers";
import { createRequire } from "node:module";

// Node 22 friendly import of the broker
const require = createRequire(import.meta.url);
const { createZGComputeNetworkBroker } = require("@0glabs/0g-serving-broker");

// Config
const RPC = process.env.RPC_ENDPOINT || process.env.EVM_RPC || "https://evmrpc-testnet.0g.ai";
const TARGET_OG = parseFloat(process.env.LEDGER_OG ?? "0.10"); // fund/ensure at least this much OG on the ledger
const EXPLICIT_PROVIDER = process.env.PROVIDER_ADDR || null;

// Utils
function extractLedgerBalanceWei(ledger) {
  // Ledger often comes back as Result(7) [addr, balanceWei, totalWei, ...]
  if (ledger?.ledgerInfo?.[0]) return BigInt(ledger.ledgerInfo[0]);
  if (Array.isArray(ledger) && typeof ledger[1] === "bigint") return ledger[1];
  try { return BigInt(ledger?.[1]); } catch { return 0n; }
}

async function ensureLedgerFunded(broker, targetOG) {
  try {
    const l = await broker.ledger.getLedger();
    const balWei = extractLedgerBalanceWei(l);
    const balOG = parseFloat(formatEther(balWei));
    console.log("Current ledger balance (OG):", balOG);

    const delta = targetOG - balOG;
    if (delta > 1e-18) {
      console.log(`Topping up ledger by ${delta} OG...`);
      try {
        await broker.ledger.depositFund(delta);
      } catch (e) {
        console.warn("depositFund failed, trying addLedger:", e?.message || e);
        await broker.ledger.addLedger(delta);
      }
      const updated = await broker.ledger.getLedger();
      const updatedWei = extractLedgerBalanceWei(updated);
      console.log("Updated ledger balance (OG):", formatEther(updatedWei));
    } else {
      console.log("Ledger sufficiently funded.");
    }
    return;
  } catch (e) {
    console.log("No ledger found, creating with", targetOG, "OG...");
    await broker.ledger.addLedger(targetOG); // IMPORTANT: decimal OG, not big-int units
  }
}

function pickProvider(services) {
  // Prefer llama-3.3-70b-instruct if present; else first
  const preferred = "0xf07240Efa67755B5311bc75784a061eDB47165Dd".toLowerCase();
  const match = services.find(s => s.provider?.toLowerCase?.() === preferred);
  return match?.provider || services[0]?.provider;
}

async function main() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error("Missing PRIVATE_KEY in .env");

  const provider = new JsonRpcProvider(RPC);
  const signer = new Wallet(pk, provider);
  console.log("wallet:", await signer.getAddress());

  const broker = await createZGComputeNetworkBroker(signer);

  // 1) Ensure ledger is funded in OG decimals
  console.log("Target ledger balance (OG):", TARGET_OG);
  await ensureLedgerFunded(broker, TARGET_OG);

  // 2) Pick a provider
  const services = await broker.inference.listService();
  if (!services?.length) throw new Error("No services available");
  const selected = EXPLICIT_PROVIDER || pickProvider(services);
  console.log("Using provider:", selected);

  // Print pricing for awareness (ether-style formatting)
  const svc = services.find(s => s.provider?.toLowerCase?.() === selected.toLowerCase()) || services[0];
  const ip = svc?.inputPrice ? formatEther(svc.inputPrice) : "0";
  const op = svc?.outputPrice ? formatEther(svc.outputPrice) : "0";
  console.log("prices (OG): input=", ip, "output=", op);

  // 3) Acknowledge provider (no-op if already acknowledged)
  try {
    await broker.inference.acknowledgeProviderSigner(selected);
    console.log("acknowledgeProviderSigner: OK");
  } catch (e) {
    const msg = e?.message || String(e);
    if (msg.includes("already acknowledged")) {
      console.log("acknowledgeProviderSigner: already acknowledged");
    } else {
      console.warn("acknowledgeProviderSigner error:", msg);
    }
  }

  // 4) Final ledger snapshot
  const finalLedger = await broker.ledger.getLedger();
  const finalWei = extractLedgerBalanceWei(finalLedger);
  console.log("Final ledger balance (OG):", formatEther(finalWei));
  console.log("✅ setup complete");
}

main().catch(e => { console.error("setup error:", e?.message || e); process.exit(1); });
