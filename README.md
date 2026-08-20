# 🚀 PeerX Backend

A comprehensive, production-ready backend for a decentralized peer-to-peer trading platform. Built with **NestJS**, **TypeScript**, and **PostgreSQL**, featuring real-time WebSocket support, GraphQL API, intelligent caching, and advanced trading analytics.

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Testing](#testing)
- [Database Migrations](#database-migrations)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Monitoring & Troubleshooting](#monitoring--troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## 📖 Overview

**PeerX Backend** is the core engine of a modern trading platform that enables peer-to-peer asset swaps with insurance protection, real-time order matching, and comprehensive risk management. The system is designed for high performance, scalability, and reliability.

### Mission
To provide a secure, efficient, and user-centric trading experience with built-in safeguards against liquidation cascades and market manipulation.

---

## ⭐ Key Features

### 🔄 **Trading & Order Management**
- Real-time order matching engine
- Support for multiple asset types (fiat, crypto, commodities)
- Leveraged trading with risk management
- Position tracking and portfolio analytics
- Historical trade analysis and reporting

### 🛡️ **Insurance & Risk Management**
- Multi-layered insurance fund for liquidation protection
- Automated cascade liquidation prevention
- Dynamic coverage decisions under market stress
- Real-time fund health monitoring
- Comprehensive audit trail for all transactions

### 🔐 **Security & Authentication**
- JWT-based authentication with refresh tokens
- Two-factor authentication (2FA) via OTP
- Role-based access control (RBAC)
- QR code generation for secure setup
- Rate limiting and DDoS protection
- Request throttling

### 📊 **Real-Time Communication**
- WebSocket support via Socket.IO for live updates
- GraphQL subscriptions for real-time data streaming
- Instant notifications for trade executions and alerts
- Event-driven architecture with Bull job queues

### 💾 **Caching & Performance**
- Redis-based caching layer
- Intelligent cache invalidation
- Distributed caching for horizontal scaling
- Cache warming strategies

### 📈 **Analytics & Reporting**
- TensorFlow integration for predictive analytics
- Trade statistics and performance metrics
- Risk analytics and volatility calculations
- User behavior analysis
- CSV/XLSX export capabilities

### 🌐 **Blockchain Integration**
- Stellar network support for blockchain transactions
- USDC stablecoin integration
- On-chain settlement verification
- Ethereum compatibility (ERC-20 tokens)
- Cross-chain bridge with signer-bound multisig approvals: each bridge
  transfer requires `BRIDGE_MULTISIG_THRESHOLD` distinct authorized signers
  (configured via `BRIDGE_SIGNER_IDS`), each signer can approve a bridge at
  most once, and approvals are recorded per signer in `bridge_approvals`
  with a unique `(bridgeId, signerId)` constraint

### 📧 **Communication**
- Email notifications via Nodemailer
- SMS alerts via Twilio
- i18n support for multi-language messages
- Configurable notification preferences

### ⚙️ **Infrastructure**
- Automatic database migrations with TypeORM
- Job queue management with Bull
- Event emission and handling
- Scheduled cron jobs for maintenance tasks
- Comprehensive logging and monitoring

---

## 🛠️ Tech Stack

| Category | Technology | Version |
|----------|-----------|---------|
| **Framework** | NestJS | ^11.0.1 |
| **Language** | TypeScript | ^5.7.3 |
| **Database** | PostgreSQL / SQLite | Latest |
| **ORM** | TypeORM | ^0.3.27 |
| **API** | GraphQL & REST | Apollo & Express |
| **Real-time** | WebSocket & Socket.IO | ^4.8.1 |
| **Caching** | Redis & IORedis | Latest |
| **Job Queue** | Bull | ^4.16.5 |
| **Authentication** | JWT & OTP | jsonwebtoken, otplib |
| **Validation** | Joi & Class Validator | ^17.13.3 |
| **Testing** | Jest | ^30.0.0 |
| **Security** | Helmet | ^7.0.0 |
| **Analytics** | TensorFlow.js | ^4.20.0 |
| **Blockchain** | Stellar SDK & Ethers | Latest |
| **File Handling** | XLSX & CSV Writer | Latest |

---

## 📂 Project Structure

```
src/
├── app.module.ts                 # Root application module
├── main.ts                       # Application entry point
│
├── auth/                         # Authentication module
│   ├── strategies/              # JWT, Local, etc.
│   ├── guards/                  # Auth guards
│   ├── entities/                # Auth entities
│   ├── services/                # Auth logic
│   ├── controllers/             # Auth endpoints
│   └── auth.module.ts
│
├── users/                        # User management
│   ├── entities/
│   ├── services/
│   ├── controllers/
│   ├── dto/
│   └── users.module.ts
│
├── trading/                      # Core trading functionality
│   ├── entities/                # Trade, Position, Order entities
│   ├── services/                # Trading logic
│   ├── controllers/             # Trading endpoints
│   ├── dto/                     # Data transfer objects
│   ├── resolvers/               # GraphQL resolvers
│   └── trading.module.ts
│
├── orders/                       # Order management
│   ├── entities/
│   ├── services/
│   ├── controllers/
│   └── orders.module.ts
│
├── insurance/                    # Insurance fund system
│   ├── entities/
│   ├── services/
│   ├── controllers/
│   ├── dto/
│   ├── tests/
│   └── insurance.module.ts
│
├── blockchain/                   # Blockchain integration
│   ├── services/                # Stellar, Ethereum services
│   ├── entities/
│   └── blockchain.module.ts
│
├── notifications/               # Email, SMS, Push notifications
│   ├── services/
│   ├── templates/
│   └── notifications.module.ts
│
├── jobs/                        # Background job definitions
│   ├── services/
│   └── jobs.module.ts
│
├── events/                      # Event handling
│   ├── listeners/
│   └── events.module.ts
│
├── analytics/                   # Analytics & reporting
│   ├── services/
│   ├── dto/
│   └── analytics.module.ts
│
├── cache/                       # Caching layer
│   ├── services/
│   └── cache.module.ts
│
├── common/                      # Shared utilities
│   ├── constants/
│   ├── filters/
│   ├── interceptors/
│   ├── decorators/
│   ├── exceptions/
│   ├── guards/
│   ├── pipes/
│   └── utils/
│
├── database/                    # Database configuration
│   ├── migrations/
│   ├── seeds/
│   └── data-source.ts
│
├── config/                      # Configuration management
│   ├── env.validation.ts
│   ├── config.service.ts
│   └── configuration.ts
│
└── graphql/                     # GraphQL setup
    ├── schema.gql
    └── graphql.config.ts

test/                            # E2E tests
├── jest-e2e.json
└── app.e2e-spec.ts
```

---

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** - v18.0.0 or higher
- **npm** - v9.0.0 or higher
- **PostgreSQL** - v12.0 or higher (for production)
- **Redis** - v6.0 or higher
- **Git** - for version control

### Optional
- **Docker** & **Docker Compose** - for containerized development
- **Stellar CLI** - for blockchain testing

---

## 🚀 Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/PeerX/PeerX-Backend.git
cd PeerX-Backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Redis Setup (Local Development)

#### Option A: Using Docker (Recommended)

```bash
docker compose up -d redis
```

Redis will be available at:
- **Host**: `localhost`
- **Port**: `6379`

#### Option B: Manual Installation

```bash
# macOS
brew install redis

# Linux
sudo apt-get install redis-server

# Start Redis
redis-server
```

> **Zero-loss messaging**: the queue's zero-loss message service persists
> message state (payloads, attempts, processing leases, replication targets)
> in Redis under the `zls:*` key namespace. All state survives process
> restarts and is shared across horizontally scaled instances. A background
> recovery sweep re-queues messages whose processing lease expired (worker
> crash) exactly once, so Redis must be reachable for zero-loss guarantees
> to hold.

### 4. Database Setup

#### Development (SQLite)

SQLite database will be created automatically at first run.

#### Production (PostgreSQL)

```bash
# Create database
createdb peerx_db

# Set connection string in .env
DATABASE_URL=postgresql://user:password@localhost:5432/peerx_db
```

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory:

```bash
# Copy from template
cp .env.example .env
```

### Required Variables

```env
# Application
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# Database
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=peerx_db
DB_USERNAME=postgres
DB_PASSWORD=your_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRATION=3600
JWT_REFRESH_EXPIRATION=604800

# Blockchain
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_USDC_ISSUER=GBDT5...
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015

# Cross-chain bridge multisig
BRIDGE_MULTISIG_THRESHOLD=2        # distinct signers required to execute a bridge
BRIDGE_SIGNER_IDS=                 # comma-separated user ids authorized to approve (empty = approvals disabled)

# External Services
EXCHANGE_RATE_URL=https://api.exchangerate-api.com/v4/latest
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
EMAIL_FROM=notifications@peerx.com

# GraphQL
GRAPHQL_PLAYGROUND=true
GRAPHQL_INTROSPECTION=true

# Cache
CACHE_TTL=300
CACHE_ENABLED=true
```

**Email template resolution**: the email job processor renders the `template`
field of an email job from the registry in
`src/notifications/templates/email.templates.ts`. Supported template names are
`welcome`, `trade-completed`, and `test`; placeholders use `{{key}}` syntax
(the same convention as the i18n templates) and are HTML-escaped. Unknown
template names fall back to a generic template instead of failing the job.

**Idempotent email delivery**: each email is sent at most once, guarded by an
atomic Redis `SET ... NX EX` marker keyed by `emailId` (recipients + subject +
template). A Bull retry or a duplicate enqueue of an already-sent email is
skipped; only genuinely failed sends (where the SMTP transport threw) release
the marker and are re-sent by the queue's backoff.

### Optional Variables

```env
# Feature Flags
FEATURE_2FA_ENABLED=true
FEATURE_TRADING_ENABLED=true
FEATURE_INSURANCE_ENABLED=true

# Performance
CACHE_MAX_SIZE=1000
JOB_QUEUE_CONCURRENCY=5
DB_CONNECTION_POOL_SIZE=20

# Monitoring
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project
DATADOG_API_KEY=your_datadog_key
```

---

## 🏃 Running the Application

### Development Mode (with hot-reload)

```bash
npm run start:dev
```

Application will start on `http://localhost:3000`

### Watch Mode

```bash
npm run start:watch
```

### Debug Mode

```bash
npm run start:debug
```

Debugger will listen on port `9229`

### Production Mode

```bash
# Build
npm run build

# Start
npm run start:prod
```

---

## 🧪 Testing

### Run All Tests

```bash
npm run test
```

### Unit Tests

```bash
npm run test -- insurance-fund.service.spec
npm run test -- auth.service.spec
```

### Test Coverage

```bash
npm run test:cov
```

Generates coverage report in `coverage/` directory

### E2E Tests

```bash
npm run test:e2e
```

### Watch Mode (Tests)

```bash
npm run test:watch
```

### Security Audit

```bash
npm run test:security
npm run audit:deps
```

---

## 🗄️ Database Migrations

### Generate Migration

```bash
npm run migration:generate -- CreateUsersTable
```

### Run Migrations

```bash
npm run migration:run
```

### Revert Last Migration

```bash
npm run migration:revert
```

---

## 📚 API Documentation

### REST API

- **Swagger UI**: `http://localhost:3000/api/docs`
- **OpenAPI Spec**: `http://localhost:3000/api/docs-json`

#### Queue Management API

The queue subsystem exposes two controller groups, both protected by JWT
authentication (`JwtAuthGuard`) and documented with `@ApiBearerAuth()`:

| Endpoint group | Auth requirement |
| --- | --- |
| `GET api/queue/metrics*`, `GET api/queue/health` | Any authenticated user (valid access token) |
| `POST/DELETE api/queue/jobs/*`, `POST api/queue/pause/*`, `POST api/queue/resume/*`, `DELETE api/queue/empty/*`, `POST api/queue/trigger/*`, `POST api/queue/test/*` | Authenticated user with `ADMIN` role (`RbacGuard` + `@Roles(UserRole.ADMIN)`) |
| All `api/admin/queue/*` routes (dashboard, metrics, health, DLQ, retry policies, control, jobs) | Authenticated user with `ADMIN` role |

Non-admin callers receive `403 Forbidden` on admin-only routes; unauthenticated
callers receive `401 Unauthorized` on every queue route. `SUPER_ADMIN` inherits
`ADMIN` privileges through the RBAC hierarchy.

### GraphQL API

- **GraphQL Playground**: `http://localhost:3000/graphql`
- **GraphQL Endpoint**: `POST http://localhost:3000/graphql`

#### Example Query

```graphql
query GetTrades {
  trades(limit: 10) {
    id
    symbol
    price
    volume
    status
    createdAt
  }
}
```

#### Example Mutation

```graphql
mutation CreateTrade {
  createTrade(input: {
    symbol: "BTC/USD"
    quantity: 1.5
    price: 45000
  }) {
    id
    status
    message
  }
}
```

### WebSocket Connection

```javascript
const io = require('socket.io-client');

const socket = io('http://localhost:3000', {
  auth: {
    token: 'your-jwt-token'
  }
});

socket.on('trade:created', (data) => {
  console.log('New trade:', data);
});

socket.on('price:updated', (data) => {
  console.log('Price update:', data);
});
```

---

## 🚢 Deployment

### Docker Deployment

```bash
# Build image
docker build -t peerx-backend:latest .

# Run container
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL=postgresql://... \
  peerx-backend:latest
```

### Docker Compose

```bash
docker compose -f docker-compose.prod.yml up -d
```

### Heroku Deployment

```bash
heroku login
heroku create peerx-backend
heroku config:set NODE_ENV=production
git push heroku main
```

### AWS Deployment

See [DEPLOYMENT.md](./docs/DEPLOYMENT.md) for detailed AWS setup instructions.

---

## 📊 Monitoring & Troubleshooting

### Health Check

```bash
curl http://localhost:3000/health
```

Expected Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z",
  "database": "connected",
  "redis": "connected"
}
```

### Common Issues

#### Database Connection Error

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution**: Ensure PostgreSQL is running and DATABASE_URL is correct

#### Redis Connection Error

```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solution**: Start Redis: `redis-server` or `docker compose up -d redis`

#### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

#### Out of Memory Error

```bash
# Increase Node.js heap size
node --max-old-space-size=4096 dist/main.js
```

### Logging

Logs are configured with different levels:

- **ERROR**: Critical errors requiring immediate attention
- **WARN**: Warning messages for potential issues
- **INFO**: General application information
- **DEBUG**: Detailed debugging information

Change log level in `.env`:
```env
LOG_LEVEL=debug
```

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow ESLint rules: `npm run lint`
- Format code: `npm run format`
- Write tests for new features
- Update documentation

---

## 📋 Scripts Reference

| Command | Purpose |
|---------|---------|
| `npm run build` | Build TypeScript to JavaScript |
| `npm run start` | Start production server |
| `npm run start:dev` | Start development server with hot-reload |
| `npm run start:debug` | Start with debugger |
| `npm run start:prod` | Start production build |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm test` | Run unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:cov` | Run tests with coverage |
| `npm run test:e2e` | Run E2E tests |
| `npm run migration:generate` | Generate new migration |
| `npm run migration:run` | Run pending migrations |
| `npm run migration:revert` | Revert last migration |
| `npm run audit:deps` | Audit dependencies for vulnerabilities |

---

## 🛡️ Insurance fund concurrency model

Insurance fund payouts must never double-spend a balance. Two rules are
enforced in code so every future payout follows the same pattern:

1. **Balance changes are single atomic UPDATEs, never read-modify-write.**
   `InsuranceFundService.recordTransaction()` applies payouts as
   `UPDATE insurance_funds SET balance = balance - :amount WHERE id = :id AND
   balance >= :amount` and checks the affected-row count. If the guard fails
   (insufficient balance — from the start or because a concurrent payout
   drained the fund first), the payout is rejected with
   `BadRequestException('Insufficient fund balance for payout')` and the
   balance can never go negative. Replenishments and fee contributions use
   the same unconditional atomic `balance + :amount` update.
2. **Multi-tier coverage runs in one transaction with a fixed lock order.**
   `LiquidationProtectionService.coverShortfall()` debits tiers in the fixed
   `TIER_PRIORITY` order (LOW → MEDIUM → HIGH → CRITICAL) inside a single
   `dataSource.transaction()`. Concurrent liquidations acquire fund row locks
   in the same order, so they serialize instead of deadlocking, and the
   liquidation event row is committed together with the debits. Health
   recalculation and domain events run only after commit, so they never
   observe a rolled-back transaction.

Partial coverage is an explicit outcome, not a swallowed error: when no tier
has enough balance, the liquidation event is persisted with
`status = 'PARTIAL'` and a `liquidation.shortfall` event is emitted with
`cascadePrevented: false`. A tier with no initialized fund is skipped; every
other failure aborts the transaction and propagates.

The concurrency tests live in `src/protection/insurance-fund-concurrency.spec.ts`
(two real SQLite connections on one file database, WAL mode — SQLite's MVCC,
which models Postgres row-lock semantics). They prove that two concurrent
payouts exceeding the balance yield exactly one success and one rejection with
no negative balance, and that concurrent `coverShortfall` calls never deadlock
or overdraw.

---

## 📄 License

This project is licensed under the **UNLICENSED** license. See the [LICENSE](./LICENSE) file for details.

---

## 📞 Support & Community

- **Issues**: [GitHub Issues](https://github.com/PeerX/PeerX-Backend/issues)
- **Discussions**: [GitHub Discussions](https://github.com/PeerX/PeerX-Backend/discussions)
- **Documentation**: [Full Docs](./docs)
- **Email**: support@peerx.io

---

## 🔗 Related Projects

- [PeerX Frontend](https://github.com/PeerX/PeerX-Frontend)
- [Stellar SDK](https://github.com/stellar/js-stellar-sdk)
- [NestJS Documentation](https://docs.nestjs.com)

---

## 📈 Roadmap

### Phase 1 (Current)
- ✅ Core trading functionality
- ✅ Insurance fund system
- ✅ Real-time WebSocket updates
- ✅ GraphQL API

### Phase 2 (Planned)
- 🔲 Mobile app integration
- 🔲 Advanced order types
- 🔲 Margin trading enhancements
- 🔲 Cross-chain support

### Phase 3 (Future)
- 🔲 AI-powered trading assistant
- 🔲 Decentralized governance
- 🔲 Multi-chain liquidity pools
- 🔲 Advanced analytics dashboard

---

**Made with ❤️ by the PeerX Team**

Last Updated: June 2024 | Version: 1.0.0
