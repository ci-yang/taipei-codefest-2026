import { describe, expect, it } from 'vitest';
import { router } from '@/router';

describe('benefits-only routes', () => {
  it('只公開福利雷達入口', () => {
    const routes = router.getRoutes();

    expect(routes.find((route) => route.name === 'benefits')?.path).toBe('/');
    expect(routes.some((route) => route.path === '/benefits')).toBe(true);
    expect(routes.some((route) => route.path === '/map')).toBe(false);
    expect(routes.some((route) => route.path === '/about')).toBe(false);
  });
});
