import os, sys, json, argparse, pathlib
import numpy as np
from dotenv import load_dotenv

# allow 'from crypto_py.crypto import ...' when running from /aggregator
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from crypto_py.crypto import decrypt_with_private, sha256_hex

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--round', type=int, required=True)
    args = ap.parse_args()

    load_dotenv()
    tee_priv = os.getenv('TEE_PRIVATE_KEY_B64')
    if not tee_priv:
        raise SystemExit('TEE_PRIVATE_KEY_B64 missing in .env')

    in_dir = pathlib.Path('out') / f'round-{args.round}'
    pkgs = sorted(in_dir.glob('*.cipher.json'))
    if not pkgs:
        raise SystemExit(f'No cipher packages in {in_dir}')

    vecs = []
    for p in pkgs:
        pkg = json.loads(p.read_text(encoding='utf-8'))
        pt  = decrypt_with_private(tee_priv, pkg)
        payload = json.loads(pt.decode('utf-8'))
        vec = np.array(payload['data'], dtype=np.float32)
        vecs.append(vec)

    mat = np.stack(vecs, axis=0)
    avg = mat.mean(axis=0).astype(np.float32)

    npy_path = in_dir / 'global_model.npy'
    np.save(npy_path, avg)
    blob = avg.tobytes()
    (in_dir / 'global_model.json').write_text(
        json.dumps({"shape": list(avg.shape), "dtype":"float32", "sha256": sha256_hex(blob)}),
        encoding='utf-8'
    )

    print(json.dumps({
        "inputs": len(pkgs),
        "global_npy": str(npy_path),
        "sha256": sha256_hex(blob),
        "dim": list(avg.shape)
    }))

if __name__ == '__main__':
    main()
