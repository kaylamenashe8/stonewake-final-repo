import { z } from 'zod';

// Strictness policy: small, fully documented bodies (health, error envelopes) are strictObject, so an
// extra or missing key fails. Large live payloads (deals, network, ownership) pin the contract fields
// we assert on and tolerate additive fields, so a new product field does not break the suite.

/** Every non-validation error: `{error:{code,message}}` (401 unauthenticated, 403 forbidden, 404 not_found). */
export const ErrorEnvelope = z.strictObject({
  error: z.strictObject({ code: z.string().min(1), message: z.string().min(1) }),
});

/** 422 body: the envelope plus the FastAPI-style `detail` list that names the offending parameter. */
export const ValidationErrorEnvelope = z.strictObject({
  error: z.strictObject({ code: z.literal('validation_failed'), message: z.string().min(1) }),
  detail: z
    .array(z.object({ type: z.string(), loc: z.array(z.union([z.string(), z.number()])), msg: z.string() }))
    .min(1),
});

/** List routes answer `{items, limit, offset, total}`. */
export const listEnvelope = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    limit: z.number().int().min(1),
    offset: z.number().int().min(0),
    total: z.number().int().min(0),
  });

export const NOT_FOUND = { error: { code: 'not_found', message: 'Resource not found.' } } as const;
export const UNAUTHENTICATED = {
  error: { code: 'unauthenticated', message: 'Missing or invalid credentials.' },
} as const;

/** `/org/*` (dashboard-session routes) refusals add a top-level `detail` string to the envelope. */
export const OrgErrorEnvelope = z.strictObject({
  error: z.strictObject({ code: z.string().min(1), message: z.string().min(1) }),
  detail: z.string().min(1),
});

export const METHOD_NOT_ALLOWED = {
  error: { code: 'method_not_allowed', message: 'Method not allowed.' },
} as const;
