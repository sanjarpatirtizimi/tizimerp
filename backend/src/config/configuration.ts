export interface AppConfig {
  port: number;
  jwt: {
    accessSecret: string;
    accessExpiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  business: {
    stampAmountUzs: number;
    recognitionCooldownMinutes: number;
  };
  security: {
    deviceCredentialsEncKey: string;
    hikvisionWebhookSecret: string;
  };
}

export default (): { app: AppConfig } => ({
  app: {
    port: parseInt(process.env.PORT ?? '3001', 10),
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret',
      accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
      refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
    },
    business: {
      stampAmountUzs: parseInt(process.env.STAMP_AMOUNT_UZS ?? '40000', 10),
      recognitionCooldownMinutes: parseInt(
        process.env.RECOGNITION_COOLDOWN_MINUTES ?? '60',
        10,
      ),
    },
    security: {
      deviceCredentialsEncKey:
        process.env.DEVICE_CREDENTIALS_ENC_KEY ??
        '0000000000000000000000000000000000000000000000000000000000000',
      hikvisionWebhookSecret:
        process.env.HIKVISION_WEBHOOK_SECRET ?? 'dev-webhook-secret',
    },
  },
});
