import type { Context } from "hono";
import type { User } from "~/db/schema";

export const getCurrentUserController = {
  /**
   * Mendapatkan user yang terautentikasi dari context atau API
   */
  async getUser(c: Context): Promise<Omit<User, "passwordHash"> | null> {
    try {
      // if User in context use it
      if (c.var.user) {
        console.log(
          "[getCurrentUser] Using user from context:",
          c.var.user.email
        );
        const { passwordHash, ...userWithoutPassword } = c.var.user;
        return userWithoutPassword;
      }

      //   if not in context, fetch API as fallback
      const BASE_URL =
        process.env.BASE_URL || (c.req.url ? new URL(c.req.url).origin : "");
      const cookies = c.req.header("Cookie") || "";
      console.log("[getCurrentUser] Raw cookies:", cookies);
      console.log("[getCurrentUser] Fetching user from API");
      try {
        const res = await fetch(`${BASE_URL}/api/auth/me`, {
          headers: {
            Cookie: cookies,
            Origin: c.req.header("Origin") || BASE_URL,
            "User-Agent": c.req.header("User-Agent") || "",
          },
        });

        console.log(`[getCurrentUser] API status: ${res.status}`);

        if (!res.ok) {
          console.log("[getCurrentUser] API response not OK");
          return null;
        }

        const data = await res.json();
        console.log("[getCurrentUser] API response:", data);

        if (!data.success || !data.user) {
          console.log("[getCurrentUser] API returned no user");
          return null;
        }

        console.log(
          "[getCurrentUser] Successfully retrieved user:",
          data.user.email
        );
        return data.user;
      } catch (err) {
        console.error("[getCurrentUser] API validation error:", err);
        return null;
      }
    } catch (error) {
      console.error("[getCurrentUser] Error:", error);
      return null;
    }
  },

  /**
   * Mengecek apakah user saat ini terautentikasi
   */
  async isAuthenticated(c: Context): Promise<boolean> {
    const user = await this.getUser(c);
    return !!user;
  },
};
