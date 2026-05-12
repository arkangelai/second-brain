export const ErrorCode = {
  VaultNotFound: "VAULT_NOT_FOUND",
  NoteNotFound: "NOTE_NOT_FOUND",
  InvalidContract: "INVALID_CONTRACT",
  Unauthorized: "UNAUTHORIZED",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
