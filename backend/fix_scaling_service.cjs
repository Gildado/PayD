
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/services/dbScalingService.ts');
let src = fs.readFileSync(filePath, 'utf8');

// 1. Replace the Prisma import with the pg pool import
src = src.replace(
  `import { PrismaClient } from '@prisma/client';`,
  `import pool from '../config/database.js';`
);

// 2. Remove POOL_MAX, POOL_MIN, prismaInstance, and getPrismaClient
// These span from "const POOL_MAX..." to the closing "}\n" of getPrismaClient
const singletonStart = src.indexOf('const POOL_MAX = Number(process.env.DB_POOL_MAX');
const singletonEnd = src.indexOf('\nexport class DbScalingService');
if (singletonStart !== -1 && singletonEnd !== -1) {
  const before = src.slice(0, singletonStart);
  const after = src.slice(singletonEnd);
  const helper = `const POOL_MAX = Number(process.env.DB_POOL_MAX ?? 20);
const POOL_MIN = Number(process.env.DB_POOL_MIN ?? 2);

// Tagged-template helper that mirrors Prisma's $queryRaw<T>\`SQL\` API.
// Uses the existing pg pool – no Prisma client needed.
function query<T>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> {
  let text = '';
  strings.forEach((str, i) => {
    text += str;
    if (i < values.length) text += '$' + (i + 1);
  });
  return pool.query(text, values as unknown[]).then((r) => r.rows as T[]);
}

`;
  src = before + helper + after;
}

// 3. Remove the class's private prisma field and constructor
src = src.replace(
  `export class DbScalingService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = getPrismaClient();
  }`,
  'export class DbScalingService {'
);

// 4. Replace all "this.prisma.$queryRaw" with "query"
//    (The template literal angle-bracket type params stay, the template tag changes)
src = src.replace(/this\.prisma\.\$queryRaw/g, 'query');

// 5. Fix the plain $queryRaw`SELECT 1` call in runHealthCheck (no type param)
src = src.replace(
  "await query`SELECT 1`;",
  "await pool.query('SELECT 1');"
);

fs.writeFileSync(filePath, src);
console.log('Done. Lines:', src.split('\n').length);
