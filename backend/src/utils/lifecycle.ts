import type { RequestHandler } from 'express';

let shuttingDown = false;
let inFlightRequests = 0;
const idleResolvers = new Set<() => void>();

export function isShuttingDown(): boolean {
  return shuttingDown;
}

export function setShuttingDown(value: boolean): void {
  shuttingDown = value;
}

export function getInFlightRequests(): number {
  return inFlightRequests;
}

function resolveIdleWaiters(): void {
  if (inFlightRequests !== 0) return;

  for (const resolve of idleResolvers) {
    resolve();
  }
  idleResolvers.clear();
}

export function waitForInFlightRequests(timeoutMs: number): Promise<boolean> {
  if (inFlightRequests === 0) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      idleResolvers.delete(onIdle);
      resolve(false);
    }, timeoutMs);

    const onIdle = () => {
      clearTimeout(timer);
      resolve(true);
    };

    idleResolvers.add(onIdle);
  });
}

export const inFlightRequestMiddleware: RequestHandler = (_req, res, next) => {
  inFlightRequests += 1;

  res.once('finish', () => {
    inFlightRequests = Math.max(0, inFlightRequests - 1);
    resolveIdleWaiters();
  });

  res.once('close', () => {
    if (!res.writableEnded) {
      inFlightRequests = Math.max(0, inFlightRequests - 1);
      resolveIdleWaiters();
    }
  });

  next();
};

export function _resetLifecycleForTests(): void {
  shuttingDown = false;
  inFlightRequests = 0;
  idleResolvers.clear();
}
