import "dotenv/config";
import { JsonRpcProvider, Wallet, formatEther } from "ethers";
import OpenAI from "openai";
import { createRequire } from "node:module";

// Node 22 friendly import of the broker
const require = createRequire(import.meta.url);
const { createZGComputeNetworkBroker } = require("@0glabs/0g-serving-broker");

const RPC = process.env.RPC_ENDPOINT || process.env.EVM_RPC || "https://evmrpc-testnet.0g.ai";
const EXPLICIT_PROVIDER = process.env.PROVIDER_ADDR || null;
const PROMPT = process.env.PROMPT || "Say hello from FLAI on 0G.";

// CLI args: --provider 0x..., --prompt "text"
function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
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
  const broker = await createZGComputeNetworkBroker(signer);

  // Pick provider and ensure it's acknowledged (safe to re-call)
  const services = await broker.inference.listService();
  if (!services?.length) throw new Error("No services available");
  const selected = arg("provider", EXPLICIT_PROVIDER) || pickProvider(services);
  console.log("Using provider:", selected);

  try {
    await broker.inference.acknowledgeProviderSigner(selected);
    console.log("Provider acknowledged.");
  } catch (e) {
    const msg = e?.message || String(e);
    if (msg.includes("already acknowledged")) console.log("Provider already acknowledged.");
    else console.warn("ack error:", msg);
  }

  // Get service metadata
  const { endpoint, model } = await broker.inference.getServiceMetadata(selected);
  console.log("endpoint:", endpoint);
  console.log("model:", model);

  const prompt = arg("prompt", PROMPT);
  console.log("prompt:", prompt);

  // Generate single-use auth headers
  const headers = await broker.inference.getRequestHeaders(selected, prompt);
  console.log("Auth headers ready.");

  // Optional: show current ledger balance before
  const before = await broker.ledger.getLedger();
  const beforeWei = Array.isArray(before) && typeof before[1] === "bigint" ? before[1] : 0n;
  console.log("Ledger before (OG):", formatEther(beforeWei));

  // Call the provider using OpenAI client with custom headers
  const openai = new OpenAI({ baseURL: endpoint, apiKey: "" });
  const completion = await openai.chat.completions.create(
    { model, messages: [{ role: "user", content: prompt }] },
    { headers }
  );

  const aiResponse = completion?.choices?.[0]?.message?.content || "";
  const chatId = completion?.id;
  console.log("AI response:", aiResponse);
  console.log("Chat ID:", chatId);

  // Process response (verification + payment)
  try {
    const ok = await broker.inference.processResponse(selected, aiResponse, chatId);
    console.log("processResponse:", ok ? "Valid / payment settled" : "Invalid");
  } catch (e) {
    console.warn("processResponse error:", e?.message || e);
  }

  // Final ledger
  const after = await broker.ledger.getLedger();
  const afterWei = Array.isArray(after) && typeof after[1] === "bigint" ? after[1] : 0n;
  console.log("Ledger after (OG):", formatEther(afterWei));
  console.log("✅ ping complete");
}

main().catch(e => { console.error("ping error:", e?.message || e); process.exit(1); });
