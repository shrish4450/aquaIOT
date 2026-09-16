"""
AQUA-NEXUS Cryptographic Security and Token Utilities
Provides salted password hashing and cryptographically signed session tokens.
"""

import base64
import hashlib
import hmac
import json
import os
import time
from typing import Optional, Dict, Any

# Cryptographic Secret Key for Token Signatures
SECRET_KEY = os.getenv("AUTH_SECRET_KEY", "aqua-nexus-super-secure-production-key-2026")
TOKEN_EXPIRY_SECONDS = 86400 * 7  # 7 days


def hash_password(password: str) -> str:
    """Hashes a password using PBKDF2-HMAC-SHA256 with a unique random 16-byte salt."""
    salt = os.urandom(16).hex()
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    ).hex()
    return f"{salt}${key}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plaintext password against a stored salt$hash string."""
    try:
        salt, stored_key = hashed_password.split('$', 1)
        computed_key = hashlib.pbkdf2_hmac(
            'sha256',
            plain_password.encode('utf-8'),
            salt.encode('utf-8'),
            100000
        ).hex()
        return hmac.compare_digest(stored_key, computed_key)
    except Exception:
        return False


def create_access_token(payload: Dict[str, Any], expires_in: int = TOKEN_EXPIRY_SECONDS) -> str:
    """Creates a cryptographically signed token containing user claims."""
    token_data = payload.copy()
    token_data["exp"] = int(time.time()) + expires_in
    raw_bytes = json.dumps(token_data, separators=(',', ':')).encode('utf-8')
    payload_b64 = base64.urlsafe_b64encode(raw_bytes).decode('utf-8').rstrip('=')

    sig = hmac.new(SECRET_KEY.encode('utf-8'), payload_b64.encode('utf-8'), hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).decode('utf-8').rstrip('=')

    return f"{payload_b64}.{sig_b64}"


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodes and validates the cryptographic signature and expiration of a token."""
    try:
        parts = token.split('.')
        if len(parts) != 2:
            return None
        payload_b64, sig_b64 = parts

        # Verify Signature
        expected_sig = hmac.new(SECRET_KEY.encode('utf-8'), payload_b64.encode('utf-8'), hashlib.sha256).digest()
        expected_sig_b64 = base64.urlsafe_b64encode(expected_sig).decode('utf-8').rstrip('=')

        if not hmac.compare_digest(sig_b64, expected_sig_b64):
            return None

        # Decode payload
        rem = len(payload_b64) % 4
        if rem > 0:
            payload_b64 += '=' * (4 - rem)
        raw_json = base64.urlsafe_b64decode(payload_b64).decode('utf-8')
        claims = json.loads(raw_json)

        # Check expiry
        if claims.get("exp", 0) < time.time():
            return None

        return claims
    except Exception:
        return None
