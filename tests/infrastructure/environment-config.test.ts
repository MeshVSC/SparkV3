// Environment configuration validation tests
import { validateEnvironment } from '../setup';

interface EnvironmentConfig {
  nodeEnv: string;
  databaseUrl: string;
  nextAuthSecret: string;
  nextAuthUrl?: string;
  apiUrl: string;
  socketUrl: string;
  logLevel: string;
  rateLimits: {
    windowMs: number;
    max: number;
  };
  features: {
    emailNotifications: boolean;
    pushNotifications: boolean;
    analytics: boolean;
    monitoring: boolean;
  };
}

const environmentConfigs: Record<string, EnvironmentConfig> = {
  development: {
    nodeEnv: 'development',
    databaseUrl: 'file:./dev.db',
    nextAuthSecret: 'dev-secret',
    apiUrl: 'http://localhost:3000/api',
    socketUrl: 'ws://localhost:3000/api/socketio',
    logLevel: 'debug',
    rateLimits: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000 // requests per window
    },
    features: {
      emailNotifications: false,
      pushNotifications: false,
      analytics: false,
      monitoring: false
    }
  },
  staging: {
    nodeEnv: 'staging',
    databaseUrl: 'postgresql://staging-db-url',
    nextAuthSecret: 'staging-secret',
    nextAuthUrl: 'https://staging.example.com',
    apiUrl: 'https://staging.example.com/api',
    socketUrl: 'wss://staging.example.com/api/socketio',
    logLevel: 'info',
    rateLimits: {
      windowMs: 15 * 60 * 1000,
      max: 500
    },
    features: {
      emailNotifications: true,
      pushNotifications: false,
      analytics: true,
      monitoring: true
    }
  },
  production: {
    nodeEnv: 'production',
    databaseUrl: 'postgresql://production-db-url',
    nextAuthSecret: 'production-secret',
    nextAuthUrl: 'https://app.example.com',
    apiUrl: 'https://app.example.com/api',
    socketUrl: 'wss://app.example.com/api/socketio',
    logLevel: 'error',
    rateLimits: {
      windowMs: 15 * 60 * 1000,
      max: 100
    },
    features: {
      emailNotifications: true,
      pushNotifications: true,
      analytics: true,
      monitoring: true
    }
  }
};

describe('Environment Configuration Tests', () => {
  describe('Environment Variable Validation', () => {
    test('validates development environment', () => {
      const originalEnv = process.env;
      
      // Mock development environment
      process.env = {
        ...originalEnv,
        NODE_ENV: 'development',
        DATABASE_URL: 'file:./dev.db',
        NEXTAUTH_SECRET: 'dev-secret'
      };

      const validation = validateEnvironment('development');
      expect(validation.valid).toBe(true);

      process.env = originalEnv;
    });

    test('validates staging environment', () => {
      const originalEnv = process.env;
      
      process.env = {
        ...originalEnv,
        NODE_ENV: 'staging',
        DATABASE_URL: 'postgresql://staging-db',
        NEXTAUTH_SECRET: 'staging-secret',
        NEXTAUTH_URL: 'https://staging.example.com'
      };

      const validation = validateEnvironment('staging');
      expect(validation.valid).toBe(true);

      process.env = originalEnv;
    });

    test('validates production environment', () => {
      const originalEnv = process.env;
      
      process.env = {
        ...originalEnv,
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://prod-db',
        NEXTAUTH_SECRET: 'prod-secret',
        NEXTAUTH_URL: 'https://app.example.com'
      };

      const validation = validateEnvironment('production');
      expect(validation.valid).toBe(true);

      process.env = originalEnv;
    });

    test('detects missing environment variables', () => {
      const originalEnv = process.env;
      
      // Missing required variables
      process.env = {
        NODE_ENV: 'production'
        // Missing DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL
      };

      const validation = validateEnvironment('production');
      expect(validation.valid).toBe(false);
      expect(validation.missing).toContain('DATABASE_URL');
      expect(validation.missing).toContain('NEXTAUTH_SECRET');
      expect(validation.missing).toContain('NEXTAUTH_URL');

      process.env = originalEnv;
    });
  });

  describe('Configuration Loading', () => {
    test.each(Object.entries(environmentConfigs))('loads %s configuration correctly', (env, config) => {
      expect(config.nodeEnv).toBe(env);
      expect(config.databaseUrl).toBeDefined();
      expect(config.nextAuthSecret).toBeDefined();
      expect(config.apiUrl).toBeDefined();
      expect(config.socketUrl).toBeDefined();
      expect(config.logLevel).toBeDefined();
      expect(config.rateLimits).toBeDefined();
      expect(config.features).toBeDefined();
    });

    test('applies environment-specific overrides', () => {
      const devConfig = environmentConfigs.development;
      const prodConfig = environmentConfigs.production;

      // Development should be more permissive
      expect(devConfig.rateLimits.max).toBeGreaterThan(prodConfig.rateLimits.max);
      expect(devConfig.logLevel).toBe('debug');
      expect(prodConfig.logLevel).toBe('error');

      // Production should have all features enabled
      expect(prodConfig.features.emailNotifications).toBe(true);
      expect(prodConfig.features.pushNotifications).toBe(true);
      expect(devConfig.features.emailNotifications).toBe(false);
    });
  });

  describe('Security Configuration', () => {
    test('validates secure configurations for production', () => {
      const prodConfig = environmentConfigs.production;

      // Should use HTTPS in production
      expect(prodConfig.apiUrl).toMatch(/^https:/);
      expect(prodConfig.socketUrl).toMatch(/^wss:/);
      expect(prodConfig.nextAuthUrl).toMatch(/^https:/);

      // Should have stricter rate limits
      expect(prodConfig.rateLimits.max).toBeLessThan(environmentConfigs.development.rateLimits.max);
    });

    test('allows insecure configurations for development', () => {
      const devConfig = environmentConfigs.development;

      // HTTP is OK for development
      expect(devConfig.apiUrl).toMatch(/^http:/);
      expect(devConfig.socketUrl).toMatch(/^ws:/);
    });

    test('validates secret strength', () => {
      const validateSecretStrength = (secret: string): boolean => {
        return secret.length >= 32 && !/^(dev|test|simple)/.test(secret);
      };

      // Development secrets can be simple
      expect(validateSecretStrength('dev-secret')).toBe(false);

      // Production secrets should be strong
      const strongSecret = 'production-secret-with-sufficient-entropy-12345';
      expect(validateSecretStrength(strongSecret)).toBe(true);
    });
  });

  describe('Database Configuration', () => {
    test('validates database connection strings', () => {
      const validateDatabaseUrl = (url: string, env: string): boolean => {
        if (env === 'development') {
          return url.startsWith('file:') || url.startsWith('postgresql:');
        }
        return url.startsWith('postgresql:') && url.includes('ssl=true');
      };

      expect(validateDatabaseUrl('file:./dev.db', 'development')).toBe(true);
      expect(validateDatabaseUrl('postgresql://prod-db?ssl=true', 'production')).toBe(true);
      expect(validateDatabaseUrl('file:./prod.db', 'production')).toBe(false);
    });

    test('configures connection pooling by environment', () => {
      const getPoolConfig = (env: string) => {
        const configs = {
          development: { min: 1, max: 5, idle: 30000 },
          staging: { min: 2, max: 10, idle: 15000 },
          production: { min: 5, max: 20, idle: 10000 }
        };
        return configs[env as keyof typeof configs];
      };

      const devPool = getPoolConfig('development');
      const prodPool = getPoolConfig('production');

      expect(prodPool.max).toBeGreaterThan(devPool.max);
      expect(prodPool.min).toBeGreaterThan(devPool.min);
      expect(prodPool.idle).toBeLessThan(devPool.idle);
    });
  });

  describe('Feature Flags', () => {
    test('enables features based on environment', () => {
      const devFeatures = environmentConfigs.development.features;
      const prodFeatures = environmentConfigs.production.features;

      // Development should disable external services
      expect(devFeatures.emailNotifications).toBe(false);
      expect(devFeatures.pushNotifications).toBe(false);

      // Production should enable all features
      expect(prodFeatures.emailNotifications).toBe(true);
      expect(prodFeatures.pushNotifications).toBe(true);
      expect(prodFeatures.analytics).toBe(true);
      expect(prodFeatures.monitoring).toBe(true);
    });

    test('validates feature dependencies', () => {
      const validateFeatures = (features: EnvironmentConfig['features']) => {
        const issues: string[] = [];

        // Push notifications require email notifications setup
        if (features.pushNotifications && !features.emailNotifications) {
          issues.push('Push notifications require email service configuration');
        }

        return issues;
      };

      const devFeatures = environmentConfigs.development.features;
      const prodFeatures = environmentConfigs.production.features;

      expect(validateFeatures(devFeatures)).toHaveLength(0);
      expect(validateFeatures(prodFeatures)).toHaveLength(0);

      // Test invalid configuration
      const invalidFeatures = { ...devFeatures, pushNotifications: true };
      expect(validateFeatures(invalidFeatures)).toContain('Push notifications require email service configuration');
    });
  });

  describe('Logging Configuration', () => {
    test('sets appropriate log levels by environment', () => {
      const logLevels = ['debug', 'info', 'warn', 'error'];
      const levelPriority = (level: string) => logLevels.indexOf(level);

      const devLevel = environmentConfigs.development.logLevel;
      const stagingLevel = environmentConfigs.staging.logLevel;
      const prodLevel = environmentConfigs.production.logLevel;

      // Production should have the highest priority (least verbose)
      expect(levelPriority(prodLevel)).toBeGreaterThan(levelPriority(devLevel));
      expect(levelPriority(stagingLevel)).toBeGreaterThan(levelPriority(devLevel));
    });

    test('configures log output destinations', () => {
      const getLogConfig = (env: string) => {
        return {
          development: { console: true, file: false, remote: false },
          staging: { console: true, file: true, remote: true },
          production: { console: false, file: true, remote: true }
        }[env] || { console: true, file: false, remote: false };
      };

      const devLogs = getLogConfig('development');
      const prodLogs = getLogConfig('production');

      expect(devLogs.console).toBe(true);
      expect(prodLogs.console).toBe(false);
      expect(prodLogs.remote).toBe(true);
    });
  });
});