import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

/**
 * Global error handler (SAST-008).
 *
 * Unexpected server errors are logged with full detail but never sent to the client: their messages can contain
 * database errors, file paths or other internals. The client gets a generic message and the request id, which matches
 * the server log entry.
 *
 * Client errors (4xx: validation, auth, rate limit, payload too large, ...) are re-thrown, which hands them to Fastify's
 * default error handler, so those responses stay exactly as they were.
 */
export function internalErrorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  const status = error.statusCode ?? (error as { status?: number }).status;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    if (error instanceof Error) {
      throw error; // Fastify falls back to its default handler
    }
    // Plain objects (e.g. @fastify/rate-limit's errorResponseBuilder result) are sent as the body with their status,
    // exactly like Fastify's default handler does. Re-throwing them would turn the reply into a 200.
    return reply.code(status).send(error);
  }
  request.log.error({ err: error }, 'Unhandled server error');
  const code = typeof status === 'number' && status >= 500 && status < 600 ? status : 500;
  return reply.status(code).send({
    statusCode: code,
    error: 'Internal Server Error',
    message: 'Something went wrong on our side. Please try again.',
    requestId: request.id,
  });
}
