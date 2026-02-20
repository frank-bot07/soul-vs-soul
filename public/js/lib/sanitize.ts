/** Client-side content sanitization */

/** Strip any HTML tags from a string (belt-and-suspenders; DOM helpers already escape) */
export function stripTags(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

/** Sanitize a display string: strip tags, limit length */
export function sanitizeDisplay(input: string, maxLength: number = 500): string {
  const stripped = stripTags(input);
  if (stripped.length > maxLength) {
    return stripped.slice(0, maxLength) + '…';
  }
  return stripped;
}

/** Validate that a string is safe for display (no script injection patterns) */
export function isSafe(input: string): boolean {
  const dangerous = /<script|javascript:|on\w+\s*=/i;
  return !dangerous.test(input);
}
