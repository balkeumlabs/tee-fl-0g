import base64
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey
from cryptography.hazmat.primitives import serialization

priv = X25519PrivateKey.generate()
pub = priv.public_key()

priv_b64 = base64.b64encode(priv.private_bytes(
    encoding=serialization.Encoding.Raw,
    format=serialization.PrivateFormat.Raw,
    encryption_algorithm=serialization.NoEncryption()
)).decode("ascii")

pub_b64 = base64.b64encode(pub.public_bytes(
    encoding=serialization.Encoding.Raw,
    format=serialization.PublicFormat.Raw
)).decode("ascii")

print(priv_b64)
print(pub_b64)
