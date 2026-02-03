/**
 * Shared validation and sanitization utilities for edge functions
 */

/**
 * Validate Telegram ID format (5-15 digits)
 */
export function isValidTelegramId(telegramId: string | number): boolean {
  const id = String(telegramId).trim();
  return /^\d{5,15}$/.test(id);
}

/**
 * Sanitize value for Google Sheets to prevent formula injection
 * Prefixes values starting with =, +, -, @ with a single quote
 */
export function sanitizeForSheets(value: string | null | undefined): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (trimmed.startsWith('=') || trimmed.startsWith('+') || 
      trimmed.startsWith('-') || trimmed.startsWith('@')) {
    return "'" + trimmed;
  }
  return trimmed;
}

/**
 * Escape HTML special characters for safe Telegram HTML messages
 */
export function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Sanitize filename to prevent path traversal and invalid characters
 */
export function sanitizeFilename(filename: string | null | undefined): string {
  if (!filename) return 'unnamed_file';
  return filename
    .replace(/[\\/\x00]/g, '_')  // Remove path separators and null bytes
    .replace(/^\.+/, '_')        // Prevent hidden files (leading dots)
    .replace(/[<>:"|?*]/g, '_')  // Remove Windows-invalid chars
    .substring(0, 200);          // Limit length
}

/**
 * Validate and sanitize text input with length limit
 */
export function validateTextInput(
  text: string | null | undefined, 
  maxLength: number = 5000
): { valid: boolean; value: string; error?: string } {
  if (!text || typeof text !== 'string') {
    return { valid: false, value: '', error: 'Text is required' };
  }
  
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { valid: false, value: '', error: 'Text cannot be empty' };
  }
  
  if (trimmed.length > maxLength) {
    return { valid: false, value: '', error: `Text exceeds maximum length of ${maxLength}` };
  }
  
  return { valid: true, value: trimmed };
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string | null | undefined): boolean {
  if (!uuid || typeof uuid !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}
