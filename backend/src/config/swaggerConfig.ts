import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';
import { fileURLToPath } from 'url';
import { mergeGeneratedRouteDocs } from './swaggerRouteFallback.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PayD Backend API',
      version: '1.0.0',
      description: 'API Documentation for PayD Backend',
    },
    servers: [
      {
        url: 'http://localhost:4000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: [
      {
        name: 'System',
        description: 'Health checks, discovery, and generated documentation endpoints',
      },
    ],
    paths: {
      '/.well-known/stellar.toml': {
        get: {
          tags: ['System'],
          summary: 'Get the published stellar.toml metadata file',
          security: [],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/api': {
        get: {
          tags: ['System'],
          summary: 'Get API discovery metadata',
          security: [],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/api/health': {
        get: {
          tags: ['System'],
          summary: 'Get API health status',
          security: [],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/api/v1/health': {
        get: {
          tags: ['System'],
          summary: 'Get API v1 health status',
          security: [],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/health': {
        get: {
          tags: ['System'],
          summary: 'Get service health status',
          security: [],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/api/openapi.json': {
        get: {
          tags: ['System'],
          summary: 'Get the generated OpenAPI specification',
          security: [],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/api/v1/openapi.json': {
        get: {
          tags: ['System'],
          summary: 'Get the generated OpenAPI specification (v1 endpoint)',
          security: [],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
    },
  },
  apis: [path.join(__dirname, '../routes/*.ts'), path.join(__dirname, '../routes/**/*.ts')],
};

export const swaggerSpec = mergeGeneratedRouteDocs(
  swaggerJsdoc(options),
  path.join(__dirname, '../routes')
);
