import "dotenv/config";
import fetch from "cross-fetch";
import { Wallet, JsonRpcProvider } from "ethers";
import { createRequire } from "node:module";

// Load broker via CommonJS (stable on Node 22)
const require = createRequire(import.meta.url);
const brokerPkg = require("@0glabs/0g-serving-broker");
const { createZGComputeNetworkBroker } = brokerPkg;

function getArg(name, def = undefined) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx > -1 ? process.argv[idx + 1] : def;
}

async function main() {
  const rpc = process.env.RPC_ENDPOINT || process.env.EVM_RPC;
  const pk  = process.env.PRIVATE_KEY;
  if (!rpc || !pk) {
    console.error("Missing RPC_ENDPOINT/EVM_RPC or PRIVATE_KEY in .env");
    process.exit(1);
  }

  const provider = new JsonRpcProvider(rpc);
  await provider.getBlockNumber(); // throws if RPC is down

  const signer = new Wallet(pk, provider);
  const broker = await createZGComputeNetworkBroker(signer);

  // Pick provider: --provider <address> or fallback to first from discovery
  let providerAddr = getArg("provider");
  let service;
  if (!providerAddr) {
    const svcs = await broker.inference.listService();
    if (!svcs?.length) {
      console.error("No services available to ping.");
      process.exit(1);
    }
    service = svcs[0];
    providerAddr = service.provider;
  }

  // Metadata: endpoint + model
  const md = await broker.inference.getServiceMetadata(providerAddr);
  if (!md?.endpoint) {
    console.error("Missing endpoint for provider", providerAddr, md);
    process.exit(1);
  }
  const endpoint = md.endpoint.replace(/\/+$/, "");
  const model = md.model || "unknown-model";

  // Minimal content to sign; SDK returns required headers
  const content = {
    model,
    messages: [{ role: "user", content: "Say hello from FLAI / Balkeum." }],
    max_tokens: 32
  };

  const headers = await broker.inference.getRequestHeaders(providerAddr, content);

  // NOTE: endpoints shown were http://... (not TLS). Accept for test/demo only.
  const url = `${endpoint}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(content),
  });

  console.log("status:", res.status);
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    console.log("json:", JSON.stringify(json, null, 2));
  } catch {
    console.log("body:", text);
  }
}

main().catch((e) => {
  console.error("ping error:", e?.message ?? e);
  process.exit(1);
});
