// app/server/services/jwt.service.ts
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import type { User } from "~/db/schema";

// Get JWT secrets dari environment variables
const ACCESS_TOKEN_SECRET =
  process.env.ACCESS_TOKEN_SECRET || "access-token-secret";
const REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || "refresh-token-secret";

// Konfigurasi token expiration
const ACCESS_TOKEN_EXPIRY = "15m"; // 15 menit
const REFRESH_TOKEN_EXPIRY = "30d"; // 30 hari

// Type untuk payload JWT token
interface JwtPayload {
  sub: string; // User ID
  email: string;
  role: string;
  jti?: string; // JWT ID untuk tracking token
}

export class JwtService {
  // Generate access token
  static generateAccessToken(user: User): { token: string; expiresIn: number } {
    const payload: JwtPayload = {
      sub: user.id.toString(),
      email: user.email,
      role: user.role,
      jti: nanoid(), // Unique token ID
    };

    const token = jwt.sign(payload, ACCESS_TOKEN_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });

    // Hitung expiry dalam timestamp
    const decoded = jwt.decode(token) as { exp: number };
    const expiresIn = decoded.exp * 1000; // Convert to milliseconds

    return { token, expiresIn };
  }

  // Generate refresh token
  // Ubah tipe kembalian untuk menyertakan jti
  static generateRefreshToken(user: User): {
    token: string;
    expiresIn: number;
    jti: string; // Tambahkan properti jti ke tipe
  } {
    const jti = nanoid();

    const payload: JwtPayload = {
      sub: user.id.toString(),
      email: user.email,
      role: user.role,
      jti, // Simpan token ID untuk validasi atau revokasi
    };

    const token = jwt.sign(payload, REFRESH_TOKEN_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRY,
    });

    // Hitung expiry dalam timestamp
    const decoded = jwt.decode(token) as { exp: number };
    const expiresIn = decoded.exp * 1000; // Convert to milliseconds

    return { token, expiresIn, jti };
  }

  // Verify access token
  static verifyAccessToken(token: string): JwtPayload | null {
    try {
      const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET) as JwtPayload;
      return decoded;
    } catch (error) {
      return null;
    }
  }

  // Verify refresh token
  static verifyRefreshToken(token: string): JwtPayload | null {
    try {
      const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET) as JwtPayload;
      return decoded;
    } catch (error) {
      return null;
    }
  }
}
