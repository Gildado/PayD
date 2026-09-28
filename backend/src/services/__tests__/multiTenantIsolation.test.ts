import { employeeService } from '../employeeService.js';
import tenantConfigService from '../tenantConfigService.js';
import { pool } from '../../config/database.js';

jest.mock('../../config/database', () => ({
  pool: {
    query: jest.fn(),
  },
}));

describe('Multi-tenant query isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('employeeService.findAll scopes by organization_id', async () => {
    (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

    await employeeService.findAll(42, {
      page: 1,
      limit: 10,
      sort_by: 'created_at',
      sort_order: 'desc',
    });

    const [query, params] = (pool.query as jest.Mock).mock.calls[0];
    expect(query).toContain('organization_id = $');
    expect(params).toContain(42);
  });

  it('employeeService.findById scopes by employee id + organization_id', async () => {
    (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

    await employeeService.findById(7, 2);

    const [query, params] = (pool.query as jest.Mock).mock.calls[0];
    expect(query).toContain('WHERE id = $1 AND organization_id = $2');
    expect(params).toEqual([7, 2]);
  });

  it('employeeService.update scopes by organization_id', async () => {
    (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

    await employeeService.update(7, 2, { status: 'inactive' });

    const [query, params] = (pool.query as jest.Mock).mock.calls[0];
    expect(query).toContain('organization_id = $');
    expect(params).toContain(2);
  });

  it('tenantConfigService.getConfig scopes by organization_id', async () => {
    (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

    await tenantConfigService.getConfig(3, 'branding');

    const [query, params] = (pool.query as jest.Mock).mock.calls[0];
    expect(query).toContain('WHERE organization_id = $1 AND config_key = $2');
    expect(params).toEqual([3, 'branding']);
  });

  it('tenantConfigService.setConfig scopes upsert by organization_id', async () => {
    (pool.query as jest.Mock).mockResolvedValue({ rows: [{ id: 1 }] });

    await tenantConfigService.setConfig(5, 'payment_settings', { require_dual_approval: true });

    const [query, params] = (pool.query as jest.Mock).mock.calls[0];
    expect(query).toContain(
      'INSERT INTO tenant_configurations (organization_id, config_key, config_value, description)'
    );
    expect(params[0]).toBe(5);
    expect(params[1]).toBe('payment_settings');
  });
});
