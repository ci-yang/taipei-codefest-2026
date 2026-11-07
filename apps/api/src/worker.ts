import { createEdgeApp, type PlatformBindings } from './edge-app';

export default {
  fetch(request: Request, env: PlatformBindings): Response | Promise<Response> {
    return createEdgeApp(env).fetch(request);
  },
};
