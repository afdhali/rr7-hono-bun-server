// app/server/services/jwt.service.ts
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import type { User } from "~/db/schema";

// Get JWT secrets dari environment variables dengan fallback
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
  jti: string; // JWT ID untuk tracking token
  fingerprint?: {
    userAgent?: string;
    ipAddress?: string;
    family?: string;
  };
}

export class JwtService {
  // Generate access token with fingerprinting
  static generateAccessToken(
    user: User,
    fingerprint?: { userAgent?: string; ipAddress?: string; family?: string }
  ): { token: string; expiresIn: number; jti: string } {
    const jti = nanoid(); // Generate token ID

    const payload: JwtPayload = {
      sub: user.id.toString(),
      email: user.email,
      role: user.role,
      jti, // Menggunakan jti yang disimpan dalam variabel
    };

    // Add fingerprint if provided
    if (fingerprint) {
      payload.fingerprint = fingerprint;
    }

    const token = jwt.sign(payload, ACCESS_TOKEN_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
      notBefore: 0, // Token valid immediately
      audience: process.env.JWT_AUDIENCE || "app-users",
      issuer: process.env.JWT_ISSUER || "auth-service",
    });

    // Hitung expiry dalam timestamp
    const decoded = jwt.decode(token) as { exp: number };
    const expiresIn = decoded.exp * 1000; // Convert to milliseconds

    return { token, expiresIn, jti }; // Return jti juga
  }

  // Generate refresh token
  static generateRefreshToken(user: User): {
    token: string;
    expiresIn: number;
    jti: string;
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
      notBefore: 0, // Token valid immediately
      audience: process.env.JWT_AUDIENCE || "app-users",
      issuer: process.env.JWT_ISSUER || "auth-service",
    });

    // Hitung expiry dalam timestamp
    const decoded = jwt.decode(token) as { exp: number };
    const expiresIn = decoded.exp * 1000; // Convert to milliseconds

    return { token, expiresIn, jti };
  }

  // Verify access token - fixed type casting
  static verifyAccessToken(token: string): JwtPayload | null {
    try {
      // Perbaikan: casting tipe yang tepat untuk jwt.verify
      const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET, {
        audience: process.env.JWT_AUDIENCE || "app-users",
        issuer: process.env.JWT_ISSUER || "auth-service",
      });

      // Pastikan bahwa decoded adalah JwtPayload yang diharapkan
      return decoded as JwtPayload;
    } catch (error) {
      return null;
    }
  }

  // Verify refresh token - fixed type casting
  static verifyRefreshToken(token: string): JwtPayload | null {
    try {
      // Perbaikan: casting tipe yang tepat untuk jwt.verify
      const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET, {
        audience: process.env.JWT_AUDIENCE || "app-users",
        issuer: process.env.JWT_ISSUER || "auth-service",
      });

      // Pastikan bahwa decoded adalah JwtPayload yang diharapkan
      return decoded as JwtPayload;
    } catch (error) {
      return null;
    }
  }
}
