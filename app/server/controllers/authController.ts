// app/server/controllers/auth.controller.ts
import { type Context } from "hono";
import { randomBytes } from "crypto";
import { eq, and, gt } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/db";
import { users, emailVerifications, type User } from "~/db/schema";
import { EmailService } from "../services/email.service";
import { createZodErrorResponse } from "../utils/zodErrors";

// Validation schema for registration
const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[^a-zA-Z0-9]/,
      "Password must contain at least one special character"
    ),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(["super_admin", "admin", "user"]).optional().default("user"),
});

export class AuthController {
  /**
   * User registration controller
   * Used in API endpoint and can also be accessed from React Router context
   */
  static async register(c: Context): Promise<{
    success: boolean;
    user?: Omit<User, "passwordHash">;
    message?: string;
    requiresVerification?: boolean;
    errors?: Record<string, string[]>;
  }> {
    try {
      // Parse data from request body
      const body = await c.req.json();

      // Validate input using Zod
      const validationResult = registerSchema.safeParse(body);

      if (!validationResult.success) {
        return createZodErrorResponse(validationResult.error);
      }

      const validatedData = validationResult.data;

      // Check if email is already registered
      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, validatedData.email),
      });

      if (existingUser) {
        return {
          success: false,
          message: "Email already exists",
          errors: {
            email: ["Email already exists"],
          },
        };
      }

      // Hash password with Bun.password
      const passwordHash = await Bun.password.hash(validatedData.password, {
        algorithm: "bcrypt",
        cost: 12,
      });

      // Create new user with isVerified = false
      const newUser = {
        email: validatedData.email,
        passwordHash,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        role: validatedData.role,
        isVerified: false,
      };

      // Create user in database
      const [createdUser] = await db.insert(users).values(newUser).returning();

      // Generate verification token
      const verificationToken = this.generateVerificationToken();

      // Set expiration time 24 hours
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      // Save verification token in database
      await db.insert(emailVerifications).values({
        userId: createdUser.id,
        token: verificationToken,
        expiresAt,
        isUsed: false,
      });

      // Send verification email
      try {
        await EmailService.sendVerificationEmail(
          createdUser,
          verificationToken
        );
      } catch (error) {
        console.error("Failed Sending Verification Email:", error);
        // Continue even if email fails to send
      }

      // Return user without password hash
      const { passwordHash: _, ...userWithoutPassword } = createdUser;

      return {
        success: true,
        user: userWithoutPassword,
        message:
          "Registration successful. Please check your email to verify your account",
        requiresVerification: true,
      };
    } catch (error) {
      console.error("Registration error:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Registration failed",
      };
    }
  }

  /**
   * Email verification controller
   * Used in API endpoint
   */
  static async verifyEmail(c: Context): Promise<{
    success: boolean;
    user?: Omit<User, "passwordHash">;
    message?: string;
    errors?: Record<string, string[]>;
  }> {
    try {
      // Get token from query parameter
      const token = c.req.query("token");

      // Validate token
      if (!token) {
        return {
          success: false,
          message: "No verification token! Please contact Administrator",
          errors: {
            token: ["No verification token! Please contact Administrator"],
          },
        };
      }

      // Find verification entry
      const verification = await db.query.emailVerifications.findFirst({
        where: and(
          eq(emailVerifications.token, token),
          eq(emailVerifications.isUsed, false),
          gt(emailVerifications.expiresAt, new Date())
        ),
        with: {
          user: true,
        },
      });

      if (!verification) {
        return {
          success: false,
          message: "Verification token has expired",
          errors: {
            token: ["Verification token has expired"],
          },
        };
      }

      // Update user as verified
      await db
        .update(users)
        .set({ isVerified: true })
        .where(eq(users.id, verification.userId));

      // Mark verification token as used
      await db
        .update(emailVerifications)
        .set({ isUsed: true })
        .where(eq(emailVerifications.id, verification.id));

      // Get updated user
      const verifiedUser = await db.query.users.findFirst({
        where: eq(users.id, verification.userId),
      });

      if (!verifiedUser) {
        return {
          success: false,
          message: "User not found",
          errors: {
            token: ["User not found"],
          },
        };
      }

      // Send welcome email
      try {
        await EmailService.sendWelcomeEmail(verifiedUser);
      } catch (error) {
        console.error("Failed Sending Welcome Email:", error);
        // Continue even if email fails to send
      }

      // Return user without password hash
      const { passwordHash: _, ...userWithoutPassword } = verifiedUser;

      return {
        success: true,
        user: userWithoutPassword,
        message: "Email successfully verified",
      };
    } catch (error) {
      console.error("Email verification error:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Verification failed",
      };
    }
  }

  /**
   * Resend verification email controller
   * Used in API endpoint
   */
  static async resendVerification(c: Context): Promise<{
    success: boolean;
    message: string;
    errors?: Record<string, string[]>;
  }> {
    try {
      // Parse data from request body
      const body = await c.req.json();
      const email = body.email;

      // Validate email
      if (!email || typeof email !== "string" || !email.includes("@")) {
        return {
          success: false,
          message: "Invalid email format",
          errors: {
            email: ["Invalid email format"],
          },
        };
      }

      // Find user
      const user = await db.query.users.findFirst({
        where: eq(users.email, email),
      });

      if (!user) {
        // For security, don't disclose whether email exists or not
        return {
          success: true,
          message:
            "If your email is registered, a verification link will be sent",
        };
      }

      if (user.isVerified) {
        return {
          success: false,
          message: "Email is already verified",
          errors: {
            email: ["Email is already verified"],
          },
        };
      }

      // Generate new verification token
      const verificationToken = this.generateVerificationToken();

      // Set expiration time 24 hours
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      // Cancel old tokens
      await db
        .update(emailVerifications)
        .set({ isUsed: true })
        .where(eq(emailVerifications.userId, user.id));

      // Save new verification token
      await db.insert(emailVerifications).values({
        userId: user.id,
        token: verificationToken,
        expiresAt,
        isUsed: false,
      });

      // Send verification email
      await EmailService.sendVerificationEmail(user, verificationToken);

      return {
        success: true,
        message:
          "If your email is registered, a verification link will be sent",
      };
    } catch (error) {
      console.error("Error resending verification email:", error);
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to send verification email",
      };
    }
  }

  /**
   * Generate random token for email verification
   */
  private static generateVerificationToken(): string {
    return randomBytes(32).toString("hex");
  }
}
