/* Copyright (C) 2026 Terwer, Inc. GPL-3.0. */
export type ConnectionMode = "hosted" | "self-hosted"
export const resolveHostedMode = (response: any): boolean => response?.hostedMode !== false

export const legacyErrorCode = (code: number, path = "", response: any = {}): string => {
  if (code === 0) return "OK"
  if (path.endsWith("/validatePassword")) return "DOCUMENT_PASSWORD_INVALID"
  if (Number(response.failCount) > 0) return "MEDIA_UPLOAD_PARTIAL_FAILURE"
  if (code === 401) return "AUTH_REQUIRED"
  if (code === 403) return path.endsWith("/vipInfo") ? "AUTH_INVALID" : "ACCESS_DENIED"
  if (code === 404) return "RESOURCE_NOT_FOUND"
  if (code === 400) return "INVALID_REQUEST"
  if (code === 503) return "SERVICE_UNAVAILABLE"
  return "INTERNAL_ERROR"
}

/** Raw settings and nested JSON values keep their shape. Old messages remain compatibility data. */
export const normalizeServiceResponse = (body: any, messages: Record<string,string> = {}, path = ""): any => {
  if (!body || typeof body !== "object" || typeof body.code !== "number") return body
  if (!path.endsWith("/vipInfo") && !["data","msg","message","errMsg","errorCode"].some(key => key in body)) return body
  const errorCode = typeof body.errorCode === "string" && body.errorCode ? body.errorCode : legacyErrorCode(body.code,path,body)
  const legacyMessage = body.legacyMessage ?? body.msg ?? body.message ?? body.errMsg ?? ""
  return {...body,errorCode,hostedMode:resolveHostedMode(body),legacyMessage,
    msg:body.code === 0 ? body.msg : (messages[errorCode] || messages.UNKNOWN_ERROR || "The sharing service could not complete this request.")}
}
