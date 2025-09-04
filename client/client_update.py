import os, json, argparse, pathlib
from dotenv import load_dotenv
import numpy as np
from crypto_py.crypto import encrypt_for_recipient, sha256_hex

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--round', type=int, required=True)
    ap.add_argument('--client-id', type=str, required=True)
    ap.add_argument('--size', type=int, default=32)
    ap.add_argument('--seed', type=int, default=0)
    args = ap.parse_args()

    load_dotenv()
    tee_pub = os.getenv('TEE_PUBLIC_KEY_B64')
    if not tee_pub:
        raise SystemExit('TEE_PUBLIC_KEY_B64 missing in .env')

    # Deterministic synthetic update for demo
    rng = np.random.default_rng(args.seed or (args.round*131 + hash(args.client_id) % 10000))
    vec = rng.normal(0, 1, size=(args.size,)).astype(np.float32)

    meta = {
        "round": args.round,
        "client_id": args.client_id,
        "shape": list(vec.shape),
        "dtype": str(vec.dtype)
    }
    payload = {"meta": meta, "data": vec.tolist()}
    plaintext = json.dumps(payload, separators=(',', ':')).encode('utf-8')

    aad_str = f"round:{args.round}|client:{args.client_id}|size:{args.size}"
    pkg = encrypt_for_recipient(tee_pub, plaintext, aad_str.encode('utf-8'))
    pkg["meta"] = meta
    pkg["plaintext_sha256"] = sha256_hex(plaintext)

    out_dir = pathlib.Path('out') / f"round-{args.round}"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"client-{args.client_id}.cipher.json"
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(pkg, f, separators=(',', ':'))

    # optional local upload/fallback
    if os.getenv('LOCAL_UPLOAD','1') == '1':
        up_dir = pathlib.Path('uploads') / f"round-{args.round}"
        up_dir.mkdir(parents=True, exist_ok=True)
        (up_dir / out_path.name).write_text(json.dumps(pkg), encoding='utf-8')

    print(json.dumps({
        "wrote": str(out_path),
        "aad": aad_str,
        "plaintext_sha256": pkg["plaintext_sha256"],
        "len_bytes": len(plaintext)
    }))
if __name__ == '__main__':
    main()
