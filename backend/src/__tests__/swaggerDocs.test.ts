import request from 'supertest';
import app from '../app.js';
import { swaggerSpec } from '../config/swaggerConfig.js';

describe('Swagger/OpenAPI documentation', () => {
  it('serves the generated OpenAPI specification', async () => {
    const response = await request(app).get('/api/openapi.json');
    const v1Response = await request(app).get('/api/v1/openapi.json');

    expect(response.status).toBe(200);
    expect(v1Response.status).toBe(200);
    expect(response.body.openapi).toBe('3.0.0');
    expect(v1Response.body.openapi).toBe('3.0.0');
    expect(response.body.paths['/api/v1/auth/register']?.post).toBeDefined();
    expect(response.body.paths['/api/v1/payments/pathfind']?.post).toBeDefined();
    expect(response.body.paths['/metrics']?.get).toBeDefined();
  });

  it('serves the Swagger UI HTML', async () => {
    const response = await request(app).get('/api-docs/');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('Swagger UI');
  });

  it('keeps fallback-generated routes in the in-memory spec', () => {
    expect(swaggerSpec.paths?.['/api/v1/auth/register']?.post).toBeDefined();
    expect(swaggerSpec.paths?.['/api/v1/notifications/history']?.get).toBeDefined();
    expect(swaggerSpec.paths?.['/api/v1/payroll/status/health']?.get).toBeDefined();
    expect(swaggerSpec.paths?.['/metrics']?.get).toBeDefined();
  });
});
