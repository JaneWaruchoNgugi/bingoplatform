/**
 * Compares Express routes registered in createApp() against the OpenAPI spec.
 * Exits 1 if any registered route is not documented.
 * Run: npm run openapi:validate-routes  (or: npx tsx scripts/validate-routes.ts)
 */

import { createApp } from '../src/app';
import { openApiSpec } from '../src/openapi/spec';

// Convert an Express regexp (set on mounted sub-routers) to a clean path segment.
// E.g. /^\/api\/v1\/health\/?(?=\/|$)/i -> /api/v1/health
function regexpToSegment(re: RegExp): string {
  return re.source
    .replace(/^\^/, '')
    .replace(/\\\//g, '/')
    .replace(/\/\?\(\?=[^)]*\).*$/, '')
    .replace(/\(\?=[^)]*\).*$/, '')
    .replace(/\?$/, '')
    .replace(/\/$/, '')
    .replace(/\\/g, '')
    || '';
}

// Convert Express param syntax :id -> {id}
function toOpenApiPath(p: string): string {
  return p.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '{$1}');
}

interface RouteEntry { method: string; path: string }

function collectRoutes(stack: any[], prefix = ''): RouteEntry[] {
  const routes: RouteEntry[] = [];
  for (const layer of stack ?? []) {
    if (layer.route) {
      const routePath = layer.route.path === '/' ? '' : layer.route.path;
      const fullPath = (prefix + routePath) || '/';
      for (const method of Object.keys(layer.route.methods)) {
        if (method !== '_all') routes.push({ method: method.toUpperCase(), path: fullPath });
      }
    } else if (layer.handle?.stack) {
      // Accumulate prefix: parent prefix + this layer's segment
      const segment = layer.regexp instanceof RegExp ? regexpToSegment(layer.regexp) : '';
      const nextPrefix = prefix + segment;
      routes.push(...collectRoutes(layer.handle.stack, nextPrefix));
    }
  }
  return routes;
}

const app = createApp();
const routerStack = (app as any)._router?.stack ?? [];
const expressed = collectRoutes(routerStack);

const SKIP_PREFIXES = ['/api/docs', '/api/openapi'];

let missing = 0;
let checked = 0;

for (const { method, path } of expressed) {
  if (SKIP_PREFIXES.some((p) => path.startsWith(p))) continue;
  checked++;
  const openApiPath = toOpenApiPath(path);
  const specEntry = (openApiSpec.paths as Record<string, any>)[openApiPath];
  if (!specEntry?.[method.toLowerCase()]) {
    console.warn(`UNDOCUMENTED: ${method} ${openApiPath}`);
    missing++;
  }
}

console.log(`\nRoute coverage: ${checked - missing}/${checked} documented`);

if (missing > 0) {
  console.error(`\n${missing} route(s) missing from OpenAPI spec.`);
  process.exit(1);
} else {
  console.log('All routes are documented. ✓');
}
