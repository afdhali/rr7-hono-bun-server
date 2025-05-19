// app/server/services/oauth.service.ts
import { eq, and, or } from "drizzle-orm";
import { db } from "~/db";
import { users, oauthAccounts, type User } from "~/db/schema";

import { revokeToken } from "@hono/oauth-providers/google";

interface GoogleUserInfo {
  googleId: string;
  name: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
  googleToken: string;
}

export class OAuthService {
  /**
   * Find existing user by email or create a new user with Google OAuth
   */
  static async findOrCreateGoogleUser(
    email: string,
    googleInfo: GoogleUserInfo
  ): Promise<{ user: User; isNewUser: boolean }> {
    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      // User exists, update or create their OAuth account info
      const oauthAccount = await db.query.oauthAccounts.findFirst({
        where: and(
          eq(oauthAccounts.userId, existingUser.id),
          eq(oauthAccounts.provider, "google")
        ),
      });

      if (oauthAccount) {
        // Update existing OAuth account
        await db
          .update(oauthAccounts)
          .set({
            providerId: googleInfo.googleId,
            accessToken: googleInfo.googleToken,
            updatedAt: new Date(),
            // Additional fields could be updated here
          })
          .where(eq(oauthAccounts.id, oauthAccount.id));
      } else {
        // Create new OAuth account for existing user
        await db.insert(oauthAccounts).values({
          userId: existingUser.id,
          provider: "google", // Ini adalah enum, tapi TypeScript akan menerima string literal "google"
          providerId: googleInfo.googleId,
          accessToken: googleInfo.googleToken,
          profile: JSON.stringify({
            name: googleInfo.name,
            picture: googleInfo.picture,
            givenName: googleInfo.givenName,
            familyName: googleInfo.familyName,
          }),
        });
      }

      return { user: existingUser, isNewUser: false };
    }

    // User doesn't exist, create a new user and OAuth account
    const newUser = {
      email,
      // Generate a secure random password for the user
      // This ensures they can't login with password but account is secure
      passwordHash: await Bun.password.hash(crypto.randomUUID(), {
        algorithm: "bcrypt",
        cost: 12,
      }),
      firstName: googleInfo.givenName || googleInfo.name.split(" ")[0],
      lastName:
        googleInfo.familyName || googleInfo.name.split(" ").slice(1).join(" "),
      role: "user" as const, // Menggunakan const assertion untuk TypeScript
      isVerified: true, // Users from Google OAuth are automatically verified
    };

    // Create user
    const [createdUser] = await db.insert(users).values(newUser).returning();

    // Create OAuth account
    await db.insert(oauthAccounts).values({
      userId: createdUser.id,
      provider: "google", // Ini akan dikonversi ke enum yang benar
      providerId: googleInfo.googleId,
      accessToken: googleInfo.googleToken,
      profile: JSON.stringify({
        name: googleInfo.name,
        picture: googleInfo.picture,
        givenName: googleInfo.givenName,
        familyName: googleInfo.familyName,
      }),
    });

    return { user: createdUser, isNewUser: true };
  }

  /**
   * Find a user by OAuth provider and provider ID
   */
  static async findUserByOAuth(
    provider: "google" | "facebook" | "github" | "twitter",
    providerId: string
  ): Promise<User | null> {
    const oauthAccount = await db.query.oauthAccounts.findFirst({
      where: and(
        eq(oauthAccounts.provider, provider),
        eq(oauthAccounts.providerId, providerId)
      ),
      with: {
        user: true,
      },
    });

    return oauthAccount?.user || null;
  }

  static async revokeOAuthTokens(userId: number) {
    try {
      // Fetch all OAuth accounts for the user
      const userOAuthAccounts = await db.query.oauthAccounts.findMany({
        where: eq(oauthAccounts.userId, userId),
      });

      // Process each account and revoke tokens
      for (const account of userOAuthAccounts) {
        if (account.provider === "google" && account.accessToken) {
          try {
            // Revoke Google OAuth token
            await revokeToken(account.accessToken);
            console.log(`[Auth] Revoked Google token for user ${userId}`);

            // Optionally, update the database to mark token as revoked
            await db
              .update(oauthAccounts)
              .set({
                accessToken: null,
                refreshToken: null,
                updatedAt: new Date(),
              })
              .where(eq(oauthAccounts.id, account.id));
          } catch (tokenError) {
            // Log error but continue with logout process
            console.error(
              `[Auth] Failed to revoke Google token: ${tokenError}`
            );
          }
        }
      }
    } catch (error) {
      console.error(`[Auth] Error revoking OAuth tokens: ${error}`);
    }
  }
}
