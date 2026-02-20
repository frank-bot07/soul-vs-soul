/** Hash-based SPA router */

export interface Route {
  pattern: RegExp;
  handler: (params: Record<string, string>) => void;
}

export class Router {
  private routes: Route[] = [];

  add(pattern: string, handler: (params: Record<string, string>) => void): void {
    const regexStr = pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)');
    this.routes.push({ pattern: new RegExp(`^${regexStr}$`), handler });
  }

  start(): void {
    window.addEventListener('hashchange', () => this.resolve());
    this.resolve();
  }

  navigate(hash: string): void {
    location.hash = hash;
  }

  resolve(): void {
    const hash = location.hash.slice(1) || '/';
    for (const route of this.routes) {
      const match = hash.match(route.pattern);
      if (match) {
        route.handler(match.groups ?? {});
        return;
      }
    }
    // Default to home
    if (this.routes.length > 0) {
      this.routes[0]!.handler({});
    }
  }
}
