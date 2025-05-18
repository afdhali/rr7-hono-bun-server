// app/server/utils/zodErrors.ts
import { ZodError } from "zod";

/**
 * Format Zod validation errors into a more usable structure
 * @param error The ZodError object from validation result
 * @returns A record of field names mapped to arrays of error messages
 */
export function formatZodErrors(error: ZodError): Record<string, string[]> {
  const formattedErrors = error.format();
  const errors: Record<string, string[]> = {};

  // Iterate through all error entries
  Object.entries(formattedErrors).forEach(([key, value]) => {
    // Skip the top-level _errors array
    if (key === "_errors") return;

    // Check if the value is an object with _errors property
    if (typeof value === "object" && value !== null && "_errors" in value) {
      const errorMessages = (value as { _errors: string[] })._errors;
      // Only add entry if there are actual error messages
      if (errorMessages.length > 0) {
        errors[key] = errorMessages;
      }
    }
  });

  return errors;
}

/**
 * Utility function that converts a ZodError into a standardized response object
 * @param error The ZodError object from validation result
 * @returns A standard error response object
 */
export function createZodErrorResponse(error: ZodError): {
  success: false;
  message: string;
  errors: Record<string, string[]>;
  status: number;
} {
  return {
    success: false,
    message: "Validation failed",
    errors: formatZodErrors(error),
    status: 400,
  };
}
