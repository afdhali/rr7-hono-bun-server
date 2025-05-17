// app/server/services/email.service.ts
import { Resend } from "resend";
import type { User } from "~/db/schema";

// Initialize Resend with API key
const resendApiKey = process.env.RESEND_API_KEY;

// Ensure API key is available
if (!resendApiKey) {
  console.warn(
    "RESEND_API_KEY has not been configured. Email sending will not function."
  );
}

const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Email template type definition
type EmailTemplate = "verification" | "welcome" | "resetPassword";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
  text?: string;
}

// Default sender email
const DEFAULT_FROM_EMAIL =
  process.env.DEFAULT_FROM_EMAIL || "no-reply@marketer.emeshdev.com";

// Base URL for verification links
const BASE_URL = process.env.APP_URL || "https://rr7honobun.emeshdev.com";

export class EmailService {
  /**
   * Send email using Resend
   */
  static async sendEmail(
    options: EmailOptions
  ): Promise<{ success: boolean; messageId?: string; error?: any }> {
    try {
      if (!resend) {
        console.error("Resend API key has not been configured");
        throw new Error("Resend API key has not been configured");
      }

      const { to, subject, html, from = DEFAULT_FROM_EMAIL, text } = options;

      const result = await resend.emails.send({
        from,
        to,
        subject,
        html,
        text,
      });

      if (result.error) {
        console.error("Failed to send email:", result.error);
        return { success: false, error: result.error };
      }

      return { success: true, messageId: result.data?.id };
    } catch (error) {
      console.error("Error sending email:", error);
      return { success: false, error };
    }
  }

  /**
   * Send verification email to user
   */
  static async sendVerificationEmail(
    user: User,
    verificationToken: string
  ): Promise<{ success: boolean; messageId?: string; error?: any }> {
    const verificationLink = `${BASE_URL}/verify-email?token=${verificationToken}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Verify Your Email</h2>
        <p>Hello ${user.firstName || "User"},</p>
        <p>Thank you for registering. Please click the link below to verify your email address:</p>
        <p>
          <a href="${verificationLink}" style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px;">
            Verify Email
          </a>
        </p>
        <p>Or, copy and paste the following link into your browser:</p>
        <p>${verificationLink}</p>
        <p>This link will expire in 24 hours.</p>
        <p>If you did not register for this account, you can ignore this email.</p>
        <p>Thank you,<br>The Application Team</p>
      </div>
    `;

    const text = `
      Verify Your Email
      
      Hello ${user.firstName || "User"},
      
      Thank you for registering. Please visit the link below to verify your email address:
      
      ${verificationLink}
      
      This link will expire in 24 hours.
      
      If you did not register for this account, you can ignore this email.
      
      Thank you,
      The Application Team
    `;

    return this.sendEmail({
      to: user.email,
      subject: "Verify Your Account",
      html,
      text,
    });
  }

  /**
   * Send welcome email after verification
   */
  static async sendWelcomeEmail(
    user: User
  ): Promise<{ success: boolean; messageId?: string; error?: any }> {
    const loginLink = `${BASE_URL}/login`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome!</h2>
        <p>Hello ${user.firstName || "User"},</p>
        <p>Your email has been successfully verified. Welcome to our application!</p>
        <p>You can now log in and start using all the features of the application.</p>
        <p>
          <a href="${loginLink}" style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px;">
            Login to Your Account
          </a>
        </p>
        <p>Thank you for joining us!</p>
        <p>Warm regards,<br>The Application Team</p>
      </div>
    `;

    const text = `
      Welcome!
      
      Hello ${user.firstName || "User"},
      
      Your email has been successfully verified. Welcome to our application!
      
      You can now log in and start using all the features of the application.
      
      Login to your account: ${loginLink}
      
      Thank you for joining us!
      
      Warm regards,
      The Application Team
    `;

    return this.sendEmail({
      to: user.email,
      subject: "Welcome to Our Application!",
      html,
      text,
    });
  }
}
