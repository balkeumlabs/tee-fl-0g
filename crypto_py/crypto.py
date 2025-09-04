import base64, os, hashlib
from typing import Optional
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey, X25519PublicKey
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

def b64e(b: bytes) -> str:
    return base64.b64encode(b).decode('ascii')

def b64d(s: str) -> bytes:
    return base64.b64decode(s)

def generate_keypair_b64():
    priv = X25519PrivateKey.generate()
    pub = priv.public_key()
    priv_b64 = b64e(priv.private_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PrivateFormat.Raw,
        encryption_algorithm=serialization.NoEncryption()))
    pub_b64 = b64e(pub.public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw))
    return priv_b64, pub_b64

def _derive_key(shared: bytes) -> bytes:
    hkdf = HKDF(algorithm=hashes.SHA256(), length=32, salt=None, info=b"FLAI-FedAvg-X25519-AESGCM")
    return hkdf.derive(shared)

def encrypt_for_recipient(recipient_pub_b64: str, plaintext: bytes, aad: Optional[bytes] = None) -> dict:
    recip_pub = X25519PublicKey.from_public_bytes(b64d(recipient_pub_b64))
    eph_priv = X25519PrivateKey.generate()
    eph_pub = eph_priv.public_key()
    shared = eph_priv.exchange(recip_pub)
    key = _derive_key(shared)
    nonce = os.urandom(12)
    aes = AESGCM(key)
    ct = aes.encrypt(nonce, plaintext, aad)
    return {
        "version": 1,
        "enc": "X25519-AESGCM",
        "epk": b64e(eph_pub.public_bytes(encoding=serialization.Encoding.Raw, format=serialization.PublicFormat.Raw)),
        "nonce": b64e(nonce),
        "ciphertext": b64e(ct),
        "aad": b64e(aad) if aad else None,
    }

def decrypt_with_private(priv_b64: str, package: dict) -> bytes:
    priv = X25519PrivateKey.from_private_bytes(b64d(priv_b64))
    epk = X25519PublicKey.from_public_bytes(b64d(package["epk"]))
    shared = priv.exchange(epk)
    key = _derive_key(shared)
    nonce = b64d(package["nonce"])
    ct = b64d(package["ciphertext"])
    aad = base64.b64decode(package["aad"]) if package.get("aad") else None
    aes = AESGCM(key)
    return aes.decrypt(nonce, ct, aad)

def sha256_hex(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()
