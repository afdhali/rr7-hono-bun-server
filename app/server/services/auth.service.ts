// app/server/services/auth.service.ts
import { eq, and, gt } from "drizzle-orm";
import { JwtService } from "./jwt.service";
import { db } from "~/db";
import { refreshTokens, users, type User, type NewUser } from "~/db/schema";

export class AuthService {
  // Register dengan Bun.password
  static async register(userData: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    role?: "super_admin" | "admin" | "user";
  }): Promise<User> {
    const { email, password, firstName, lastName, role = "user" } = userData;

    // Cek apakah email sudah terdaftar
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      throw new Error("Email already registered");
    }

    // Hash password dengan Bun.password
    const passwordHash = await Bun.password.hash(password, {
      algorithm: "bcrypt",
      cost: 12, // Work factor, higher = more secure but slower
    });

    // Buat user baru
    const newUser: NewUser = {
      email,
      passwordHash,
      firstName,
      lastName,
      role,
    };

    const [createdUser] = await db.insert(users).values(newUser).returning();
    return createdUser;
  }

  // Update metode login dengan Bun.password
  static async login(
    email: string,
    password: string,
    metadata: {
      userAgent?: string;
      ipAddress?: string;
      family?: string;
    } = {}
  ): Promise<{
    user: User;
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresIn: number;
    refreshTokenExpiresIn: number;
  }> {
    // Cari user
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      throw new Error("Invalid credentials");
    }

    // Verifikasi password dengan Bun.password
    const passwordValid = await Bun.password.verify(
      password,
      user.passwordHash
    );

    if (!passwordValid) {
      throw new Error("Invalid credentials");
    }

    // Generate fingerprint untuk token binding
    const fingerprint = {
      userAgent: metadata.userAgent || "",
      ipAddress: metadata.ipAddress || "",
      family: metadata.family || "",
    };

    // Generate JWT tokens with fingerprint
    const { token: accessToken, expiresIn: accessTokenExpiresIn } =
      JwtService.generateAccessToken(user, fingerprint);
    const {
      token: refreshToken,
      expiresIn: refreshTokenExpiresIn,
      jti,
    } = JwtService.generateRefreshToken(user);

    // Save refresh token di database
    const expiresAt = new Date(refreshTokenExpiresIn);

    await db.insert(refreshTokens).values({
      userId: user.id,
      token: refreshToken,
      expiresAt,
      userAgent: metadata.userAgent,
      ipAddress: metadata.ipAddress,
      family: metadata.family,
    });

    return {
      user,
      accessToken,
      refreshToken,
      accessTokenExpiresIn,
      refreshTokenExpiresIn,
    };
  }

  /**
   * Metode untuk membuat token untuk user yang sudah terautentikasi (misalnya via OAuth)
   * Metode ini mirip dengan login tetapi tidak melakukan verifikasi password
   */
  static async createTokensForUser(
    user: User,
    metadata: {
      userAgent?: string;
      ipAddress?: string;
      family?: string;
    } = {}
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresIn: number;
    refreshTokenExpiresIn: number;
  }> {
    // Generate fingerprint untuk token binding
    const fingerprint = {
      userAgent: metadata.userAgent || "",
      ipAddress: metadata.ipAddress || "",
      family: metadata.family || "",
    };

    // Generate JWT tokens dengan fingerprint
    const { token: accessToken, expiresIn: accessTokenExpiresIn } =
      JwtService.generateAccessToken(user, fingerprint);
    const {
      token: refreshToken,
      expiresIn: refreshTokenExpiresIn,
      jti,
    } = JwtService.generateRefreshToken(user);

    // Save refresh token di database
    const expiresAt = new Date(refreshTokenExpiresIn);

    await db.insert(refreshTokens).values({
      userId: user.id,
      token: refreshToken,
      expiresAt,
      userAgent: metadata.userAgent,
      ipAddress: metadata.ipAddress,
      family: metadata.family,
    });

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn,
      refreshTokenExpiresIn,
    };
  }

  static async getUserFromRefreshToken(token: string): Promise<User | null> {
    // Verify refresh token
    const payload = JwtService.verifyRefreshToken(token);

    if (!payload) {
      return null;
    }

    const userId = parseInt(payload.sub);

    // Cek apakah token ada di database dan belum direvoke
    const storedToken = await db.query.refreshTokens.findFirst({
      where: and(
        eq(refreshTokens.token, token),
        eq(refreshTokens.isRevoked, false),
        gt(refreshTokens.expiresAt, new Date())
      ),
    });

    if (!storedToken) {
      return null;
    }

    // Get user data
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    return user || null;
  }

  // Method untuk refresh token - tidak berubah
  static async refreshToken(token: string): Promise<{
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresIn: number;
    refreshTokenExpiresIn: number;
    user: User;
  }> {
    // Verify refresh token dengan JWT
    const payload = JwtService.verifyRefreshToken(token);

    if (!payload) {
      throw new Error("Invalid refresh token");
    }

    const userId = parseInt(payload.sub);

    // Check apakah token ada di database dan belum direvoke
    const storedToken = await db.query.refreshTokens.findFirst({
      where: and(
        eq(refreshTokens.token, token),
        eq(refreshTokens.isRevoked, false),
        gt(refreshTokens.expiresAt, new Date())
      ),
    });

    if (!storedToken) {
      throw new Error("Invalid refresh token");
    }

    // Get user data
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Recreate fingerprint dari stored token
    const fingerprint = {
      userAgent: storedToken.userAgent || "",
      ipAddress: storedToken.ipAddress || "",
      family: storedToken.family || "",
    };

    // Mark old token sebagai revoked (token rotation)
    await db
      .update(refreshTokens)
      .set({ isRevoked: true })
      .where(eq(refreshTokens.id, storedToken.id));

    // Generate new tokens with fingerprint
    const { token: newAccessToken, expiresIn: accessTokenExpiresIn } =
      JwtService.generateAccessToken(user, fingerprint);
    const {
      token: newRefreshToken,
      expiresIn: refreshTokenExpiresIn,
      jti: newJti,
    } = JwtService.generateRefreshToken(user);

    // Save new refresh token
    const expiresAt = new Date(refreshTokenExpiresIn);

    await db.insert(refreshTokens).values({
      userId: user.id,
      token: newRefreshToken,
      expiresAt,
      userAgent: storedToken.userAgent,
      ipAddress: storedToken.ipAddress,
      family: storedToken.family,
    });

    return {
      user,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      accessTokenExpiresIn,
      refreshTokenExpiresIn,
    };
  }

  // Validate access token with fingerprint check
  static async validateAccessToken(token: string): Promise<User | null> {
    // Verify JWT
    const payload = JwtService.verifyAccessToken(token);

    if (!payload) {
      return null;
    }

    const userId = parseInt(payload.sub);

    // Get user data
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return null;
    }

    // Optional: Additional checks like comparing fingerprint
    // could be performed here depending on security requirements

    return user;
  }

  // Revoke refresh token
  static async revokeRefreshToken(token: string): Promise<boolean> {
    const result = await db
      .update(refreshTokens)
      .set({ isRevoked: true })
      .where(eq(refreshTokens.token, token));

    return !!result;
  }

  // Revoke all refresh tokens for user
  static async revokeAllUserRefreshTokens(userId: number): Promise<boolean> {
    const result = await db
      .update(refreshTokens)
      .set({ isRevoked: true })
      .where(eq(refreshTokens.userId, userId));

    return !!result;
  }
}
