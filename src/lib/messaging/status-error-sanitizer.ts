import type { NormalizedStatusEvent } from "./provider";

const MAX_ERROR_FIELD_LENGTH = 500;

function sanitizeErrorField(value: string | undefined) {
  if (!value) return undefined;

  return value
    .replace(/\bBearer\s+[^\s;,]+/gi, "Bearer [REDACTED]")
    .replace(/\b(access_token|token)=([^&\s;,]+)/gi, "$1=[REDACTED]")
    .slice(0, MAX_ERROR_FIELD_LENGTH);
}

export function sanitizeStatusError(error: NormalizedStatusEvent["error"]) {
  if (!error) return undefined;

  const code = sanitizeErrorField(error.code);
  const title = sanitizeErrorField(error.title);
  const detail = sanitizeErrorField(error.detail);

  if (!code && !title && !detail && error.retryable === undefined) {
    return undefined;
  }

  return {
    ...(code ? { code } : {}),
    ...(title ? { title } : {}),
    ...(detail ? { detail } : {}),
    ...(error.retryable === undefined ? {} : { retryable: error.retryable }),
  };
}
