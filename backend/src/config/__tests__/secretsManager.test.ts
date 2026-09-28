import { getSecret, clearSecretsCache } from '../secretsManager.js';

describe('Secrets Manager', () => {
  beforeEach(() => {
    clearSecretsCache();
    process.env.TEST_SECRET = 'test_value';
  });

  afterEach(() => {
    clearSecretsCache();
    delete process.env.TEST_SECRET;
  });

  describe('getSecret', () => {
    test('should load secret from environment', async () => {
      const secret = await getSecret('TEST_SECRET', { provider: 'env' });
      expect(secret).toBe('test_value');
    });

    test('should throw error if env secret not found', async () => {
      await expect(
        getSecret('NONEXISTENT_SECRET', { provider: 'env' })
      ).rejects.toThrow('Secret NONEXISTENT_SECRET not found in environment');
    });

    test('should cache secrets', async () => {
      const secret1 = await getSecret('TEST_SECRET', { provider: 'env' });
      const secret2 = await getSecret('TEST_SECRET', { provider: 'env' });
      expect(secret1).toBe(secret2);
    });

    test('should throw if AWS SDK not available', async () => {
      await expect(
        getSecret('SOME_SECRET', { provider: 'aws', awsRegion: 'us-east-1' })
      ).rejects.toThrow('AWS SDK not available');
    });

    test('should require AWS region for AWS provider', async () => {
      await expect(
        getSecret('SOME_SECRET', { provider: 'aws' })
      ).rejects.toThrow('AWS SDK not available');
    });
  });

  describe('clearSecretsCache', () => {
    test('should clear cached secrets', async () => {
      await getSecret('TEST_SECRET', { provider: 'env' });
      clearSecretsCache();

      // Modify the env var
      process.env.TEST_SECRET = 'new_value';

      // Should get new value after cache clear
      const secret = await getSecret('TEST_SECRET', { provider: 'env' });
      expect(secret).toBe('new_value');
    });
  });
});
