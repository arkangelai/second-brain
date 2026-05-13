export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = "request_failed"
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.status }
    );
  }

  console.error(error);
  return Response.json(
    { error: "Internal server error", code: "internal_server_error" },
    { status: 500 }
  );
}
