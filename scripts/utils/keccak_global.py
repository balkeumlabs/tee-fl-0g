import sys, json, numpy as np
from pathlib import Path
from eth_hash.auto import keccak

p = Path('out/round-1/global_model.npy')
arr = np.load(p)
b = arr.tobytes()
print(json.dumps({"file": str(p), "keccak": "0x"+keccak(b).hex()}))
