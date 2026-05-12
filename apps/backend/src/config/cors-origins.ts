const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:8080',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8080',
];

export function getAllowedCorsOrigins() {
  const configuredOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configuredOrigins?.length) {
    return configuredOrigins;
  }

  return DEFAULT_ALLOWED_ORIGINS;
}
