import type { MiddlewareHandler } from 'hono';

/** Deliberately never log the URL, query, request body, headers, or error text. */
export function pathnameLogger(write: (line: string) => void = console.log): MiddlewareHandler {
  return async (c, next) => {
    await next();
    write(`${c.req.method} ${c.req.path} ${c.res.status}`);
  };
}
