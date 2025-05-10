// app/server/utils/environment.ts
/**
 * Helper untuk environment configuration
 */

// Cek apakah environment saat ini adalah production
export const isProduction = process.env.NODE_ENV === "production";
export const isDevelopment = process.env.NODE_ENV === "development";

// Get environment name dengan fallback ke development
export const getEnvironment = (): string =>
  process.env.NODE_ENV || "development";

// Helper untuk mendapatkan nilai dari environment variable dengan fallback
export const getEnv = (name: string, defaultValue: string): string => {
  return process.env[name] || defaultValue;
};

// Helper untuk get numerik env var dengan fallback
export const getNumericEnv = (name: string, defaultValue: number): number => {
  const value = process.env[name];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

// Helper untuk get boolean env var dengan fallback
export const getBooleanEnv = (name: string, defaultValue: boolean): boolean => {
  const value = process.env[name];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === "true";
};

// Security-related config
export const getSecurityConfig = () => ({
  // Cookie options
  cookieSecret: getEnv("COOKIE_SECRET", "your-cookie-secret-key"),
  cookieSecure: isProduction,

  // JWT options
  jwtAccessSecret: getEnv("ACCESS_TOKEN_SECRET", "access-token-secret"),
  jwtRefreshSecret: getEnv("REFRESH_TOKEN_SECRET", "refresh-token-secret"),
  jwtAccessExpiry: getEnv("ACCESS_TOKEN_EXPIRY", "15m"),
  jwtRefreshExpiry: getEnv("REFRESH_TOKEN_EXPIRY", "30d"),
  jwtAudience: getEnv("JWT_AUDIENCE", "app-users"),
  jwtIssuer: getEnv("JWT_ISSUER", "auth-service"),

  // CORS options
  corsOrigin: isProduction
    ? getEnv("CORS_ORIGIN", "https://yourdomain.com")
    : getEnv("CORS_ORIGIN", "http://localhost:3000"),

  // Password hashing
  passwordHashCost: getNumericEnv("PASSWORD_HASH_COST", 12),

  // Enable secure headers in production always, configurable in dev
  secureHeadersEnabled:
    isProduction || getBooleanEnv("ENABLE_SECURE_HEADERS", true),

  // Enable CSRF in production always, configurable in dev
  csrfEnabled: isProduction || getBooleanEnv("ENABLE_CSRF", true),
});
