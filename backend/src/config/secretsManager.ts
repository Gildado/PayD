type SecretsProvider = 'env' | 'aws';

interface SecretsConfig {
  provider: SecretsProvider;
  awsRegion?: string;
  cacheTtlMs?: number;
}

const cache = new Map<string, { value: string; expiresAt: number }>();

let secretsClient: any = null;

async function initAwsClient(region: string): Promise<any> {
  if (secretsClient) {
    return secretsClient;
  }

  try {
    const { SecretsManagerClient, GetSecretValueCommand } = await import(
      '@aws-sdk/client-secrets-manager'
    );
    secretsClient = { SecretsManagerClient, GetSecretValueCommand };
    return secretsClient;
  } catch {
    throw new Error('AWS SDK not available. Install @aws-sdk/client-secrets-manager or use env provider');
  }
}

async function getAwsSecret(secretName: string, region: string): Promise<string> {
  const cached = cache.get(secretName);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }

  const { SecretsManagerClient, GetSecretValueCommand } = await initAwsClient(region);
  const client = new SecretsManagerClient({ region });
  const command = new GetSecretValueCommand({ SecretId: secretName });

  try {
    const response = await client.send(command);
    const value = response.SecretString || response.SecretBinary;

    if (typeof value !== 'string') {
      throw new Error(`Invalid secret value for ${secretName}`);
    }

    cache.set(secretName, {
      value,
      expiresAt: Date.now() + (3600 * 1000), // 1 hour cache
    });

    return value;
  } catch (error) {
    throw new Error(`Failed to retrieve secret ${secretName}: ${error}`);
  }
}

function getEnvSecret(secretName: string): string {
  const value = process.env[secretName];
  if (!value) {
    throw new Error(`Secret ${secretName} not found in environment`);
  }
  return value;
}

export async function getSecret(
  secretName: string,
  config: SecretsConfig
): Promise<string> {
  if (config.provider === 'aws') {
    if (!config.awsRegion) {
      throw new Error('awsRegion is required for AWS Secrets Manager');
    }
    return getAwsSecret(secretName, config.awsRegion);
  }
  return getEnvSecret(secretName);
}

export async function loadProductionSecrets(config: SecretsConfig): Promise<Record<string, string>> {
  const secrets: Record<string, string> = {};
  const requiredSecrets = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'REDIS_URL',
  ];

  for (const secretName of requiredSecrets) {
    try {
      secrets[secretName] = await getSecret(secretName, config);
    } catch (error) {
      console.error(`Failed to load secret ${secretName}:`, error);
      if (config.provider === 'aws') {
        // In production (AWS), fail hard if a required secret is missing
        throw error;
      }
    }
  }

  return secrets;
}

export function clearSecretsCache(): void {
  cache.clear();
}
