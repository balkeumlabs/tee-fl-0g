import "dotenv/config";
import { Wallet, JsonRpcProvider } from "ethers";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const brokerPkg = require("@0glabs/0g-serving-broker");
const { createZGComputeNetworkBroker } = brokerPkg;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const env = (k, d) => (process.env[k] ?? d);

function getArg(name, def = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
}

async function main() {
  const rpc = env("RPC_ENDPOINT", env("EVM_RPC"));
  const pk  = env("PRIVATE_KEY");
  if (!rpc || !pk) throw new Error("Missing RPC_ENDPOINT/EVM_RPC or PRIVATE_KEY in .env");

  const provider = new JsonRpcProvider(rpc);
  await provider.getBlockNumber(); // health check

  const signer = new Wallet(pk, provider);
  console.log("wallet:", await signer.getAddress());

  const broker = await createZGComputeNetworkBroker(signer);

  // choose provider
  let providerAddr = getArg("provider") || env("PROVIDER_ADDR");
  const services = await (broker.listService ? broker.listService() : broker.inference.listService());
  if (!services?.length) throw new Error("No services available");
  if (!providerAddr) providerAddr = services[0].provider;
  const svc = services.find(s => s.provider.toLowerCase() === providerAddr.toLowerCase()) || services[0];
  console.log("provider:", providerAddr);
  console.log("prices(A0GI):", {
    inputPrice:  String(svc?.inputPrice ?? ""),
    outputPrice: String(svc?.outputPrice ?? "")
  });

  // Use accountProcessor auto-provisioning if available
  const ap = broker?.inference?.accountProcessor;
  if (!ap) throw new Error("accountProcessor missing in this SDK build");

  console.log("accountProcessor keys:", Object.keys(ap));

  // If thresholds exist, print them
  if (typeof ap.topUpTriggerThreshold !== "undefined") {
    console.log("topUpTriggerThreshold:", ap.topUpTriggerThreshold);
  }
  if (typeof ap.topUpTargetThreshold !== "undefined") {
    console.log("topUpTargetThreshold:", ap.topUpTargetThreshold);
  }

  // 1) Ask the processor to ensure account exists and is funded for this provider
  //    Many builds implement this helper to create + top up as needed.
  if (typeof ap.checkAccountThreshold === "function") {
    console.log("calling accountProcessor.checkAccountThreshold(provider)...");
    try {
      const res = await ap.checkAccountThreshold(providerAddr);
      console.log("checkAccountThreshold result:", res);
    } catch (e) {
      console.warn("checkAccountThreshold failed:", e?.message || e);
    }
  } else {
    console.warn("checkAccountThreshold not present; will continue.");
  }

  // small index delay
  await sleep(2000);

  // 2) Acknowledge the provider (required before header generation)
  try {
    const already = await broker.inference.userAcknowledged(providerAddr);
    console.log("userAcknowledged?", !!already);
    if (!already) {
      const ack = await broker.inference.acknowledgeProviderSigner(providerAddr);
      console.log("ack tx:", ack?.hash || ack);
    } else {
      console.log("already acknowledged");
    }
  } catch (e) {
    console.warn("ack error:", e?.message || e);
  }

  // 3) Final sanity: try fetching account detail if provided by SDK
  if (typeof broker.inference.getAccountWithDetail === "function") {
    try {
      const detail = await broker.inference.getAccountWithDetail(providerAddr);
      console.log("getAccountWithDetail:", detail);
    } catch (e) {
      console.warn("getAccountWithDetail failed:", e?.message || e);
    }
  }

  console.log("✅ account ensured (via accountProcessor) + provider acknowledged (attempted)");
}

main().catch((e) => {
  console.error("market-account error:", e?.message || e);
  process.exit(1);
});
