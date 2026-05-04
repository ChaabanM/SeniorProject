/**
 * OpenAI configuration (server-only).
 * Set OPENAI_API_KEY in web/.env.local (never commit real keys).
 */

export const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";

export const OPENAI_MODEL =
  process.env.OPENAI_MODEL ?? "gpt-5.4-2026-03-05";

export const OPENAI_BASE_URL =
  process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
