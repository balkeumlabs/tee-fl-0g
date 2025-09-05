import "dotenv/config";
import { JsonRpcProvider, Wallet, formatEther } from "ethers";
import OpenAI from "openai";
import { createRequire } from "node:module";

// Load the broker via CommonJS to be Node 22–friendly
const require = createRequire(import.meta.url);
const { createZGComputeNetworkBroker } = require("@0glabs/0g-serving-broker");

// Official providers map (from 0G sample)
const OFFICIAL_PROVIDERS = {
  "llama-3.3-70b-instruct": "0xf07240Efa67755B5311bc75784a061eDB47165Dd",
  "deepseek-r1-70b": "0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3",
};

const RPC = process.env.RPC_ENDPOINT || process.env.EVM_RPC || "https://evmrpc-testnet.0g.ai";
const TEST_QUERY = "What is the capital of France? Please answer in one sentence.";
const INITIAL_FUND_OG = parseFloat(process.env.LEDGER_OG ?? "0.10"); // 0.10 OG by default

function pickProvider(services) {
  // Prefer the official llama-3.3 provider if listed; else first service
  const favorite = OFFICIAL_PROVIDERS["llama-3.3-70b-instruct"]?.toLowerCase();
  const match = services.find(s => s.provider?.toLowerCase?.() === favorite);
  return match?.provider || services[0]?.provider;
}

async function main() {
  console.log("🚀 0G Compute Flow (JS) starting\n");

  // 1) Wallet + provider
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error("Missing PRIVATE_KEY in .env");
  const provider = new JsonRpcProvider(RPC);
  const wallet = new Wallet(pk, provider);
  console.log("Wallet:", wallet.address);
  const bal = await provider.getBalance(wallet.address);
  console.log("Wallet native balance (OG):", formatEther(bal), "\n");

  // 2) Broker
  const broker = await createZGComputeNetworkBroker(wallet);
  console.log("Broker created.\n");

  // 3) Ensure ledger exists & funded (units are OG decimals, NOT huge ints)
  console.log("Checking ledger...");
  let ledger;
  try {
    ledger = await broker.ledger.getLedger();
    console.log("Ledger exists:", ledger);
  } catch {
    console.log("No ledger found, creating with", INITIAL_FUND_OG, "OG...");
    await broker.ledger.addLedger(INITIAL_FUND_OG);  // <-- decimal OG, e.g., 0.1
    ledger = await broker.ledger.getLedger();
    console.log("Ledger created:", ledger);
  }
  console.log("");

  // 4) List services
  const services = await broker.inference.listService();
  console.log(`Found ${services.length} services`);
  services.forEach((s, i) => {
    const modelName = Object.entries(OFFICIAL_PROVIDERS).find(([_, addr]) => addr === s.provider)?.[0] || "Unknown";
    // inputPrice/outputPrice are in wei-like base units; use formatEther for readability
    const ip = s.inputPrice ? formatEther(s.inputPrice) : "0";
    const op = s.outputPrice ? formatEther(s.outputPrice) : "0";
    console.log(`  [${i+1}] ${modelName} | provider=${s.provider} | input=${ip} OG | output=${op} OG`);
  });
  console.log("");

  // 5) Pick a provider and acknowledge (first time only)
  const selected = pickProvider(services);
  if (!selected) throw new Error("No provider available to select");
  console.log("Selected provider:", selected);

  try {
    await broker.inference.acknowledgeProviderSigner(selected);
    console.log("Provider acknowledged.\n");
  } catch (e) {
    const msg = e?.message || String(e);
    if (msg.includes("already acknowledged")) {
      console.log("Provider already acknowledged.\n");
    } else {
      throw e;
    }
  }

  // 6) Get metadata
  const { endpoint, model } = await broker.inference.getServiceMetadata(selected);
  console.log("Endpoint:", endpoint);
  console.log("Model:", model, "\n");

  // 7) Generate auth headers (single use)
  const headers = await broker.inference.getRequestHeaders(selected, TEST_QUERY);
  console.log("Auth headers generated.\n");

  // 8) Send query using OpenAI client, passing custom headers
  const openai = new OpenAI({ baseURL: endpoint, apiKey: "" });
  const completion = await openai.chat.completions.create(
    { model, messages: [{ role: "user", content: TEST_QUERY }] },
    { headers }
  );

  const aiResponse = completion?.choices?.[0]?.message?.content || "";
  const chatId = completion?.id;
  console.log("AI Response:", aiResponse);
  console.log("Chat ID:", chatId, "\n");

  // 9) Process response for payment/verification
  try {
    const ok = await broker.inference.processResponse(selected, aiResponse, chatId);
    console.log("processResponse:", ok ? "Valid / payment settled" : "Invalid");
  } catch (e) {
    console.log("processResponse failed:", e?.message || e);
  }

  // 10) Final ledger snapshot
  const finalLedger = await broker.ledger.getLedger();
  console.log("\nFinal ledger:", finalLedger);
  console.log("\n✅ Flow complete.");
}

main().catch((err) => {
  console.error("\n❌ Flow failed:", err?.message || err);
  process.exit(1);
});
