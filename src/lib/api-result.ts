// Structured responses shared by every Haggle Bot backend operation.

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "OVER_BUDGET"
  | "OUT_OF_STOCK"
  | "NEGOTIATION_CLOSED"
  | "INVALID_STATE"
  | "PAYMENTS_NOT_CONFIGURED"
  | "PAYMENT_VERIFICATION_FAILED"
  | "SEARCH_NOT_CONFIGURED"
  | "PROVIDER_ERROR"
  | "RATE_LIMITED"
  | "CATALOG_SAVE_FAILED"
  | "INTERNAL_ERROR";

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  details?: Record<string, string[]> | undefined;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiErrorBody };

export const ok = <T>(data: T): ApiResult<T> => ({ ok: true, data });

export const fail = <T = never>(
  code: ApiErrorCode,
  message: string,
  details?: Record<string, string[]>,
): ApiResult<T> => ({ ok: false, error: { code, message, details } });

/** Thrown on the client by the API hooks so React Query exposes it as `error`. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly details: Record<string, string[]> | undefined;
  constructor(body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiError";
    this.code = body.code;
    this.details = body.details;
  }
}

/** Unwraps a result, throwing ApiError on failure. Maps auth-middleware rejections to UNAUTHORIZED. */
export async function unwrap<T>(call: Promise<ApiResult<T>>): Promise<T> {
  let res: ApiResult<T>;
  try {
    res = await call;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/unauthori[sz]ed/i.test(msg)) {
      throw new ApiError({ code: "UNAUTHORIZED", message: "Please sign in to continue." });
    }
    throw new ApiError({ code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." });
  }
  if (!res.ok) throw new ApiError(res.error);
  return res.data;
}
