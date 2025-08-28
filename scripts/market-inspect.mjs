import "dotenv/config";
import { Wallet, JsonRpcProvider } from "ethers";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createZGComputeNetworkBroker } = require("@0glabs/0g-serving-broker");

function env(k, d) { return process.env[k] ?? d; }

async function main() {
  const rpc = env("RPC_ENDPOINT", env("EVM_RPC"));
  const pk  = env("PRIVATE_KEY");
  const provider = new JsonRpcProvider(rpc);
  const signer   = new Wallet(pk, provider);
  const broker   = await createZGComputeNetworkBroker(signer);

  const ap = broker?.inference?.accountProcessor;
  if (!ap) throw new Error("accountProcessor missing");

  console.log("accountProcessor keys:", Object.keys(ap));

  if (ap.contract) {
    const c = ap.contract;
    console.log("account contract address:", c.target ?? c.address);
    // List available function names from the connected ethers.Contract
    const fnNames = Object.keys(c.functions || {});
    console.log("contract functions:", fnNames);

    // Try to print full signatures if ABI is exposed
    try {
      const frags = (c.interface?.fragments || []).map(f => f.format?.() || f.name || String(f));
      console.log("ABI fragments:", frags);
    } catch (e) {
      console.warn("could not dump ABI fragments:", e?.message || e);
    }
  } else {
    console.log("no ap.contract found");
  }
}

main().catch(e => (console.error(e), process.exit(1)));
