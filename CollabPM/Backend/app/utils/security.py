import bcrypt

# This module is the ONE place that knows how passwords are hashed and checked.
# Keeping it isolated means if we ever change the algorithm or cost factor, we
# change it here and nowhere else.


def hash_password(plain_password: str) -> str:
    """Turn a plaintext password into a bcrypt hash string, safe to store.

    bcrypt works on bytes, so we encode the password to UTF-8 first.

    gensalt() creates a fresh, random salt every call (with a work factor of
    12 "rounds"). The salt is a chunk of randomness mixed into the hash so that
    two users with the SAME password still get DIFFERENT hashes -- which defeats
    precomputed "rainbow table" attacks. bcrypt cleverly stores the salt and
    the cost factor INSIDE the resulting hash string, so we don't need a
    separate column for them.

    We decode the resulting bytes back to a str so it fits our VARCHAR column.
    """
    salt = bcrypt.gensalt(rounds=12)
    hashed_bytes = bcrypt.hashpw(plain_password.encode("utf-8"), salt)
    return hashed_bytes.decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Check a plaintext attempt against the stored hash. Returns True/False.

    We never "decrypt" the stored hash (you can't -- hashing is one-way).
    Instead bcrypt re-reads the salt + cost embedded in `password_hash`, hashes
    the attempt the same way, and compares. checkpw does this comparison in a
    way that resists timing attacks.
    """
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        password_hash.encode("utf-8"),
    )
