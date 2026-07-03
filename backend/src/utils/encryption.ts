import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12; // bcrypt work factor — 12 is production-grade (2^12 iterations)

/**
 * Hash a plain-text password using bcrypt.
 * Never call this with an already-hashed value.
 */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return bcrypt.hash(password, salt);
};

/**
 * Compare a plain-text password against a stored bcrypt hash.
 * Returns true if they match, false otherwise.
 * bcrypt.compare is timing-safe — safe against timing attacks.
 */
export const isPasswordMatch = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};
