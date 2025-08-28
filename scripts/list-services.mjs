import "dotenv/config";
import { Wallet, JsonRpcProvider } from "ethers";
import { createRequire } from "node:module";

// Load broker via CommonJS to avoid Node 22 ESM re-export quirks
const require = createRequire(import.meta.url);
const brokerPkg = require("@0glabs/0g-serving-broker");
const { createZGComputeNetworkBroker } = brokerPkg;

// Helper: list function-like props on an object or its prototype
const fnKeys = (o) =>
  o
    ? Object.getOwnPropertyNames(o).filter((k) => typeof o[k] === "function")
    : [];

async function main() {
  const rpc = process.env.RPC_ENDPOINT || process.env.EVM_RPC;
  const pk = process.env.PRIVATE_KEY;
  if (!rpc || !pk) {
    console.error("Missing RPC_ENDPOINT/EVM_RPC or PRIVATE_KEY in .env");
    process.exit(1);
  }

  const provider = new JsonRpcProvider(rpc);
  try {
    const bn = await provider.getBlockNumber();
    console.log("RPC ok, latest block:", bn);
  } catch (e) {
    console.error("RPC not reachable:", e?.message ?? e);
    process.exit(1);
  }

  const signer = new Wallet(pk, provider);
  const broker = await createZGComputeNetworkBroker(signer);

  // Introspection to see where methods live in this build
  console.log("broker own keys:", Object.keys(broker));
  console.log("broker proto fn keys:", fnKeys(Object.getPrototypeOf(broker)));

  if (broker.ledger) {
    console.log("ledger own keys:", Object.keys(broker.ledger));
    console.log(
      "ledger proto fn keys:",
      fnKeys(Object.getPrototypeOf(broker.ledger))
    );
  } else {
    console.log("no broker.ledger found");
  }

  if (broker.inference) {
    console.log("inference own keys:", Object.keys(broker.inference));
    console.log(
      "inference proto fn keys:",
      fnKeys(Object.getPrototypeOf(broker.inference))
    );
  } else {
    console.log("no broker.inference found");
  }

  // Try candidate locations for listService
  const candidates = [
    ["broker", broker, broker.listService],
    ["ledger", broker.ledger, broker.ledger?.listService],
    ["inference", broker.inference, broker.inference?.listService],
  ];

  let found = null;
  for (const [name, ctx, fn] of candidates) {
    if (typeof fn === "function") {
      console.log(`Using ${name}.listService()`);
      found = { name, ctx, fn };
      break;
    }
  }

  if (!found) {
    console.warn(
      "No listService() found on broker, ledger, or inference. See introspection logs above."
    );
    return;
  }

  const { ctx, fn } = found;
  const services = await fn.apply(ctx, []);
  console.log(
    "service count:",
    Array.isArray(services) ? services.length : "N/A"
  );

  // Try getServiceMetadata from possible locations
  const metaCandidates = [
    ["broker", broker, broker.getServiceMetadata],
    ["ledger", broker.ledger, broker.ledger?.getServiceMetadata],
    ["inference", broker.inference, broker.inference?.getServiceMetadata],
  ];

  let meta = null;
  for (const [name, mctx, mfn] of metaCandidates) {
    if (typeof mfn === "function") {
      console.log(`Found ${name}.getServiceMetadata()`);
      meta = { mctx, mfn };
      break;
    }
  }

  if (Array.isArray(services)) {
    for (const s of services) {
      try {
        if (meta) {
          const { mctx, mfn } = meta;
          const md = await mfn.apply(mctx, [s.provider]);
          console.log({
            provider: s.provider,
            serviceType: s.serviceType,
            endpoint: md?.endpoint,
            model: md?.model,
          });
        } else {
          console.log({
            provider: s.provider,
            serviceType: s.serviceType,
            note: "getServiceMetadata() not found in this build",
          });
        }
      } catch (err) {
        console.warn(
          "metadata fetch failed for",
          s?.provider,
          err?.message ?? err
        );
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});