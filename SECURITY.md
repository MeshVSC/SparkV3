# Security Configuration

## Environment Variables Setup

This project uses environment variables to keep sensitive information secure. Follow these steps:

### 1. Copy Environment Template
```bash
cp .env.example .env
```

### 2. Required Variables
Update these in your `.env` file:

- **NEXTAUTH_SECRET**: Generate a strong secret for JWT signing
- **DATABASE_URL**: Your database connection string
- **NEXTAUTH_URL**: Your domain (http://localhost:3000 for dev)

### 3. Optional Variables
Configure these if you need the features:

- **GITHUB_PAT**: For GitHub integration
- **SENDGRID_API_KEY**: For email notifications
- **VAPID_KEYS**: For web push notifications
- **FIREBASE_***: For mobile push notifications

### 4. Generate Secure Secrets

For `NEXTAUTH_SECRET`, use:
```bash
openssl rand -base64 32
```

### 5. Production Deployment

- Never commit `.env` files to git
- Use your hosting platform's environment variable settings
- Regenerate all secrets for production
- Use strong, unique secrets for each environment

## Security Checklist

- [x] `.env` is in `.gitignore`
- [x] No hardcoded secrets in source code
- [x] Environment variables used for all sensitive data
- [x] `.env.example` provides template
- [ ] Production secrets are different from development
- [ ] Database uses strong credentials
- [ ] HTTPS enabled in production