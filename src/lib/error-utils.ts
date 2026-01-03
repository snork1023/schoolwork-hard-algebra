/**
 * Utility functions for secure error handling.
 * These functions ensure that internal database/system details are not exposed to users.
 */

/**
 * Maps database/system errors to user-friendly messages.
 * In development mode, returns detailed error messages for debugging.
 * In production mode, returns generic user-friendly messages.
 */
export const getUserFriendlyError = (error: any): string => {
  // Always log the actual error for debugging purposes (server-side logs)
  console.error('Application error:', error);

  // In development, show detailed errors for debugging
  if (import.meta.env.DEV) {
    return error?.message || 'An unexpected error occurred';
  }

  // In production, map specific error codes to friendly messages
  const errorCode = error?.code;
  const errorMessage = error?.message?.toLowerCase() || '';

  // PostgreSQL constraint violations
  if (errorCode === '23505') {
    return 'This item already exists. Please try a different value.';
  }
  if (errorCode === '23503') {
    return 'Cannot complete this action as the item is in use.';
  }
  if (errorCode === '23502') {
    return 'Required information is missing. Please fill in all required fields.';
  }

  // RLS policy violations
  if (errorMessage.includes('row-level security') || errorMessage.includes('rls')) {
    return 'You do not have permission to perform this action.';
  }

  // Authentication errors (these are user-facing by design)
  if (errorMessage.includes('invalid login credentials')) {
    return 'Invalid email or password. Please check your credentials and try again.';
  }
  if (errorMessage.includes('user already registered')) {
    return 'An account with this email already exists. Please sign in instead.';
  }
  if (errorMessage.includes('email not confirmed')) {
    return 'Please verify your email address before signing in.';
  }
  if (errorMessage.includes('password')) {
    return 'Password does not meet requirements. Please use a stronger password.';
  }

  // Network/connection errors
  if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
    return 'Unable to connect. Please check your internet connection and try again.';
  }
  if (errorMessage.includes('timeout')) {
    return 'The request took too long. Please try again.';
  }

  // Storage errors
  if (errorMessage.includes('storage') || errorMessage.includes('bucket')) {
    return 'Unable to upload file. Please try again.';
  }

  // Generic fallback - never expose raw database errors
  return 'An error occurred. Please try again or contact support if the problem persists.';
};

/**
 * Creates an error description suitable for toast notifications.
 * Returns undefined if no specific message should be shown.
 */
export const getToastErrorDescription = (error: any): string | undefined => {
  return getUserFriendlyError(error);
};
