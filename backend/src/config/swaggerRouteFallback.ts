import fs from 'fs';
import path from 'path';

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

type OpenApiParameter = {
  in: 'path';
  name: string;
  required: true;
  schema: {
    type: 'string';
  };
};

type OpenApiOperation = {
  tags: string[];
  summary: string;
  description?: string;
  parameters?: OpenApiParameter[];
  responses: Record<string, { description: string }>;
  security?: Array<Record<string, never>>;
};

type OpenApiSpec = {
  paths?: Record<string, Partial<Record<HttpMethod, OpenApiOperation>>>;
  tags?: Array<{ name: string; description?: string }>;
};

type RouteMountConfig = {
  basePaths: string[];
  tag: string;
  description?: string;
  public?: boolean;
};

const ROUTE_MOUNTS: Record<string, RouteMountConfig> = {
  'assetPathPaymentRoutes.ts': {
    basePaths: ['/api/v1/path-payments'],
    tag: 'Path Payments',
    description: 'Cross-asset path finding and execution',
  },
  'assetRoutes.ts': {
    basePaths: ['/api/assets', '/api/v1/assets'],
    tag: 'Assets',
    description: 'Asset catalogue and issuance endpoints',
  },
  'auditRoutes.ts': {
    basePaths: ['/api/v1/audit'],
    tag: 'Audit',
    description: 'Audit and compliance endpoints',
  },
  'authRoutes.ts': {
    basePaths: ['/auth', '/api/auth', '/api/v1/auth'],
    tag: 'Auth',
    description: 'Authentication, refresh, and OAuth endpoints',
    public: true,
  },
  'balanceRoutes.ts': {
    basePaths: ['/api/v1/balance'],
    tag: 'Balances',
    description: 'Wallet and balance lookup endpoints',
  },
  'bulkPaymentRoutes.ts': {
    basePaths: ['/api/v1/bulk-payments'],
    tag: 'Bulk Payments',
    description: 'Bulk payment processing endpoints',
  },
  'claimRoutes.ts': {
    basePaths: ['/api/v1/claims'],
    tag: 'Claims',
    description: 'Claimable balance and payout claim endpoints',
  },
  'contractRoutes.ts': {
    basePaths: ['/api'],
    tag: 'Contracts',
    description: 'Contract registry endpoints',
  },
  'contractUpgradeRoutes.ts': {
    basePaths: ['/api/v1/contracts'],
    tag: 'Contract Upgrades',
    description: 'Contract registry upgrade workflows',
  },
  'employeeRoutes.ts': {
    basePaths: ['/api/employees', '/api/v1/employees'],
    tag: 'Employees',
    description: 'Employee management endpoints',
  },
  'exportRoutes.ts': {
    basePaths: ['/api/v1/exports'],
    tag: 'Exports',
    description: 'Report and data export endpoints',
  },
  'feeRoutes.ts': {
    basePaths: ['/api/v1/fees'],
    tag: 'Fees',
    description: 'Transaction fee estimation endpoints',
  },
  'freezeRoutes.ts': {
    basePaths: ['/api/v1/freeze'],
    tag: 'Freeze',
    description: 'Asset and account freeze controls',
  },
  'metricsRoutes.ts': {
    basePaths: ['/metrics'],
    tag: 'Metrics',
    description: 'Prometheus metrics endpoint',
    public: true,
  },
  'multiSigRoutes.ts': {
    basePaths: ['/api/v1/multisig'],
    tag: 'Multisig',
    description: 'Multi-signature wallet endpoints',
  },
  'notificationRoutes.ts': {
    basePaths: ['/api/notifications', '/api/v1/notifications'],
    tag: 'Notifications',
    description: 'Notification history and delivery preferences',
  },
  'paymentRoutes.ts': {
    basePaths: ['/api/payments', '/api/v1/payments'],
    tag: 'Payments',
    description: 'Payment and settlement endpoints',
  },
  'payroll.routes.ts': {
    basePaths: ['/api/payroll', '/api/v1/payroll'],
    tag: 'Payroll',
    description: 'Payroll queries, summaries, and cache controls',
  },
  'payrollAuditRoutes.ts': {
    basePaths: ['/api/payroll/audit', '/api/v1/payroll/audit'],
    tag: 'Payroll Audit',
    description: 'Payroll audit report endpoints',
  },
  'payrollBonusRoutes.ts': {
    basePaths: ['/api/v1/payroll-bonus'],
    tag: 'Payroll Bonus',
    description: 'Payroll bonus management endpoints',
  },
  'ratesRoutes.ts': {
    basePaths: ['/rates', '/api/v1/rates'],
    tag: 'Rates',
    description: 'Market and FX rate endpoints',
    public: true,
  },
  'searchRoutes.ts': {
    basePaths: ['/api/search', '/api/v1/search'],
    tag: 'Data Search',
    description: 'Employee and transaction search endpoints',
  },
  'stellarThrottlingRoutes.ts': {
    basePaths: ['/api/stellar-throttling', '/api/v1/stellar-throttling'],
    tag: 'Stellar Throttling',
    description: 'Stellar rate limiting and queue controls',
  },
  'taxRoutes.ts': {
    basePaths: ['/api/v1/taxes'],
    tag: 'Taxes',
    description: 'Payroll tax calculation endpoints',
  },
  'tenantConfigRoutes.ts': {
    basePaths: ['/api/v1/tenant-configs'],
    tag: 'Tenant Config',
    description: 'Tenant configuration management endpoints',
  },
  'throttlingRoutes.ts': {
    basePaths: ['/api/v1/throttling'],
    tag: 'Throttling',
    description: 'Request throttling and queue management endpoints',
  },
  'trustlineRoutes.ts': {
    basePaths: ['/api/v1/trustline'],
    tag: 'Trustlines',
    description: 'Trustline status and prompt endpoints',
  },
  'webhook.routes.ts': {
    basePaths: ['/webhooks', '/api/v1/webhooks'],
    tag: 'Webhooks',
    description: 'Webhook subscription and delivery endpoints',
  },
};

const ROUTE_DEFINITION_PATTERN = /router\.(get|post|put|patch|delete)\(\s*(['"`])([^'"`]+)\2/gms;

function normalizeCommentLines(rawComment: string): string[] {
  return rawComment
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:\/{2}|\*)?\s?/, '').trim())
    .filter(Boolean);
}

function extractSummaryFromLines(lines: string[]): string | undefined {
  const explicitDescription = lines.find((line) => line.startsWith('@desc '));
  if (explicitDescription) {
    return explicitDescription.replace('@desc', '').trim();
  }

  return lines.find((line) => {
    if (line.startsWith('@route') || line.startsWith('@swagger') || line.startsWith('@openapi')) {
      return false;
    }

    if (/^(get|post|put|patch|delete)\s+/i.test(line)) {
      return false;
    }

    if (line === 'Query params:') {
      return false;
    }

    return !line.startsWith('- ');
  });
}

function extractNearbyComment(content: string, routeIndex: number): string | undefined {
  const commentWindow = content.slice(Math.max(0, routeIndex - 1200), routeIndex);

  const jsdocMatch = /\/\*\*([\s\S]*?)\*\/\s*$/.exec(commentWindow);
  if (jsdocMatch) {
    const lines = normalizeCommentLines(jsdocMatch[1] ?? '');
    return extractSummaryFromLines(lines);
  }

  const lineCommentMatch = /((?:\/\/[^\n]*\r?\n\s*)+)$/.exec(commentWindow);
  if (lineCommentMatch) {
    const lines = normalizeCommentLines(lineCommentMatch[1] ?? '');
    return lines.join(' ');
  }

  return undefined;
}

function inferSummary(method: HttpMethod, routePath: string, tag: string): string {
  if (routePath === '/') {
    return `${method.toUpperCase()} ${tag}`;
  }

  return `${method.toUpperCase()} ${routePath}`;
}

function buildFullPath(basePath: string, routePath: string): string {
  const normalizedBasePath = basePath === '/' ? '' : basePath.replace(/\/+$/, '');
  const normalizedRoutePath = routePath === '/' ? '' : routePath.replace(/^\/+/, '/');
  const combinedPath = `${normalizedBasePath}${normalizedRoutePath}` || '/';

  return combinedPath.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

function buildPathParameters(fullPath: string): OpenApiParameter[] | undefined {
  const parameters = Array.from(fullPath.matchAll(/\{([^}]+)\}/g), (match) => ({
    in: 'path' as const,
    name: match[1] ?? '',
    required: true as const,
    schema: {
      type: 'string' as const,
    },
  }));

  return parameters.length > 0 ? parameters : undefined;
}

function ensureTag(spec: OpenApiSpec, tag: string, description?: string) {
  const existingTags = spec.tags ?? [];
  if (existingTags.some((entry) => entry.name === tag)) {
    return;
  }

  spec.tags = [...existingTags, { name: tag, description }];
}

export function mergeGeneratedRouteDocs(spec: OpenApiSpec, routesDirectory: string): OpenApiSpec {
  const paths = spec.paths ?? {};

  for (const [fileName, mountConfig] of Object.entries(ROUTE_MOUNTS)) {
    const routeFilePath = path.join(routesDirectory, fileName);
    if (!fs.existsSync(routeFilePath)) {
      continue;
    }

    ensureTag(spec, mountConfig.tag, mountConfig.description);

    const content = fs.readFileSync(routeFilePath, 'utf8');

    for (const routeMatch of content.matchAll(ROUTE_DEFINITION_PATTERN)) {
      const method = routeMatch[1] as HttpMethod;
      const routePath = routeMatch[3] ?? '/';
      const routeIndex = routeMatch.index ?? 0;
      const summary = extractNearbyComment(content, routeIndex);

      for (const basePath of mountConfig.basePaths) {
        const fullPath = buildFullPath(basePath, routePath);
        const existingPathItem = paths[fullPath] ?? {};

        if (existingPathItem[method]) {
          continue;
        }

        existingPathItem[method] = {
          tags: [mountConfig.tag],
          summary: summary ?? inferSummary(method, routePath, mountConfig.tag),
          parameters: buildPathParameters(fullPath),
          responses: {
            '200': {
              description: 'Success',
            },
          },
          ...(mountConfig.public ? { security: [] } : {}),
        };

        paths[fullPath] = existingPathItem;
      }
    }
  }

  spec.paths = paths;
  return spec;
}
