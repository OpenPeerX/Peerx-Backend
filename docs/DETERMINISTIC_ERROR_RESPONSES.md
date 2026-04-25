# Deterministic Error Responses Implementation Guide

## Overview

This guide describes the comprehensive system for enforcing deterministic, consistent API error responses across the SwapTrade Backend. All error responses follow a standardized format with deterministic mappings from exceptions to error codes.

## Key Principles

1. **Deterministic Mapping**: Every exception type maps to exactly one error code
2. **Consistent Format**: All error responses follow the same JSON structure
3. **Traceable Errors**: Request IDs and trace IDs enable error tracking
4. **Clear Classification**: Errors are categorized and severity-level classified
5. **Actionable Information**: Clients can determine appropriate error handling strategies

## Error Response Format

All API errors return a standardized response:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE_HTTP_STATUS",
    "message": "Human-readable error message",
    "timestamp": "2024-01-29T10:30:00.000Z",
    "requestId": "req_abc123def456",
    "retryable": false,
    "severity": "CLIENT|SERVER|TRANSIENT|WARNING",
    "category": "AUTHENTICATION|VALIDATION|BUSINESS_LOGIC|...",
    "details": {
      "field": "value",
      "reason": "specific error reason"
    }
  }
}
```

### Response Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `success` | boolean | Yes | Always `false` for errors |
| `error.code` | string | Yes | Deterministic error code (e.g., `AUTH_INVALID_CREDENTIALS_401`) |
| `error.message` | string | Yes | Human-readable error message |
| `error.timestamp` | string | Yes | ISO 8601 timestamp (UTC) |
| `error.requestId` | string | No | Request ID for tracing |
| `error.retryable` | boolean | Yes | Whether client should retry |
| `error.severity` | string | Yes | Error severity level |
| `error.category` | string | Yes | Error category for classification |
| `error.details` | object | No | Additional error context |

## Error Code Naming Convention

Error codes follow the pattern: `CATEGORY_SPECIFIC_HTTP_STATUS`

**Examples:**
- `AUTH_INVALID_CREDENTIALS_401` - Authentication failure (401 Unauthorized)
- `VALIDATION_INVALID_INPUT_400` - Validation failure (400 Bad Request)
- `BLOCKCHAIN_NETWORK_ERROR_503` - Blockchain unavailable (503 Service Unavailable)
- `DATABASE_QUERY_TIMEOUT_504` - Database timeout (504 Gateway Timeout)

## Error Categories

### Authentication & Authorization
- `AUTH_TOKEN_EXPIRED_401`
- `AUTH_INVALID_CREDENTIALS_401`
- `AUTH_INSUFFICIENT_PERMISSIONS_403`
- `AUTH_TOKEN_MISSING_401`
- `AUTH_TOKEN_INVALID_401`

### Validation
- `VALIDATION_INVALID_INPUT_400`
- `VALIDATION_MISSING_REQUIRED_FIELD_400`
- `VALIDATION_INVALID_FORMAT_400`

### Business Logic
- `BUSINESS_LOGIC_INVALID_OPERATION_400`
- `BUSINESS_LOGIC_RESOURCE_CONFLICT_409`
- `BUSINESS_LOGIC_INSUFFICIENT_BALANCE_400`

### Blockchain Operations
- `BLOCKCHAIN_TRANSACTION_FAILED_500`
- `BLOCKCHAIN_NETWORK_ERROR_503`
- `BLOCKCHAIN_INSUFFICIENT_GAS_400`

### AI Services
- `AI_SERVICE_UNAVAILABLE_503`
- `AI_SERVICE_INVALID_REQUEST_400`

### Database
- `DATABASE_CONNECTION_ERROR_503`
- `DATABASE_QUERY_TIMEOUT_504`
- `DATABASE_RECORD_NOT_FOUND_404`

### Rate Limiting
- `RATE_LIMIT_EXCEEDED_429`

### External Services
- `EXTERNAL_SERVICE_ERROR_502`
- `EXTERNAL_SERVICE_TIMEOUT_504`

### System
- `INTERNAL_SERVER_ERROR_500`

## Severity Levels

### CLIENT (400-429)
User-caused errors. Client should fix the request.

```json
{
  "severity": "CLIENT",
  "retryable": false
}
```

### SERVER (500+)
Server-side errors. Typically not retryable immediately.

```json
{
  "severity": "SERVER",
  "retryable": false
}
```

### TRANSIENT (429, Service Unavailable, etc.)
Temporary errors. Safe to retry after delay.

```json
{
  "severity": "TRANSIENT",
  "retryable": true,
  "retryAfter": 60
}
```

### WARNING
Non-critical issues. May need attention.

```json
{
  "severity": "WARNING",
  "retryable": false
}
```

## Usage Examples

### Throwing Exceptions in Services

#### Validation Exception
```typescript
import { ValidationException } from '@/error';

// Invalid input
throw ValidationException.invalidInput({
  field: 'email',
  value: 'not-an-email',
  expectedFormat: 'valid email address'
});

// Missing required field
throw ValidationException.missingRequiredField({
  field: 'password'
});

// Invalid format
throw ValidationException.invalidFormat({
  field: 'userId',
  expectedFormat: 'UUID',
  value: 'invalid-uuid'
});
```

#### Authentication Exception
```typescript
import { AuthenticationException } from '@/error';

// Token expired
throw AuthenticationException.tokenExpired({
  expiresAt: '2024-01-29T10:30:00Z'
});

// Invalid credentials
throw AuthenticationException.invalidCredentials({
  attemptedUsername: 'user@example.com',
  reason: 'Wrong password'
});

// Insufficient permissions
throw AuthenticationException.insufficientPermissions({
  required: 'ADMIN',
  actual: 'USER'
});

// Missing token
throw AuthenticationException.tokenMissing();

// Invalid token
throw AuthenticationException.tokenInvalid({
  reason: 'Signature verification failed'
});
```

#### Blockchain Exception
```typescript
import { BlockchainException } from '@/error';

// Transaction failed
throw BlockchainException.transactionFailed({
  txHash: '0x123abc...',
  reason: 'Transaction reverted'
});

// Network error
throw BlockchainException.networkError({
  endpoint: 'https://eth-mainnet.com',
  statusCode: 503
});

// Insufficient gas
throw BlockchainException.insufficientGas({
  required: '2.5 ETH',
  available: '1.0 ETH'
});
```

#### AI Service Exception
```typescript
import { AIServiceException } from '@/error';

// Service unavailable
throw AIServiceException.serviceUnavailable({
  service: 'sentiment-analyzer'
});

// Invalid request
throw AIServiceException.invalidRequest({
  reason: 'Invalid input format',
  expectedSchema: 'text: string'
});
```

### Custom Exception

For domain-specific errors, extend `StructuredException`:

```typescript
import { HttpStatus } from '@nestjs/common';
import { StructuredException } from '@/error';

export class InsufficientBalanceException extends StructuredException {
  constructor(
    asset: string,
    required: number,
    available: number,
    requestId?: string
  ) {
    super(
      'BUSINESS_LOGIC_INSUFFICIENT_BALANCE_400',
      `Insufficient balance for ${asset}. Required: ${required}, Available: ${available}`,
      HttpStatus.BAD_REQUEST,
      { asset, required, available },
      requestId,
      false // not retryable
    );
  }
}

// Usage
throw new InsufficientBalanceException('BTC', 0.5, 0.2);
```

## Request Context Usage

Track request information across your application:

```typescript
import { RequestContextService } from '@/error';
import { Injectable } from '@nestjs/common';

@Injectable()
export class SomeService {
  constructor(private requestContext: RequestContextService) {}

  async someMethod() {
    // Initialize context (done by middleware)
    this.requestContext.initializeContext('req-123', 'user-456');

    // Get request ID
    const requestId = this.requestContext.getRequestId();

    // Set metadata
    this.requestContext.setMetadata('action', 'trade');
    this.requestContext.setMetadata('amount', 100);

    // Get metadata
    const amount = this.requestContext.getMetadataValue('amount');

    // Get request duration
    const duration = this.requestContext.getDuration();

    // Clear context (done by middleware)
    this.requestContext.clearContext();
  }
}
```

## Error Code Registry

Access all error codes programmatically:

```typescript
import { ErrorCodeRegistry } from '@/error';

// Get all error codes
const allCodes = ErrorCodeRegistry.getAllErrorCodes();

// Get specific error definition
const definition = ErrorCodeRegistry.getErrorDefinition('AUTH_TOKEN_EXPIRED_401');
// Returns: {
//   code: 'AUTH_TOKEN_EXPIRED_401',
//   message: 'Authentication token has expired',
//   httpStatus: 401,
//   category: 'AUTH',
//   retryable: false,
//   severity: 'CLIENT'
// }

// Get errors by category
const authErrors = ErrorCodeRegistry.getErrorCodesByCategory('AUTH');

// Get all categories
const categories = ErrorCodeRegistry.getCategories();

// Check if error code exists
const exists = ErrorCodeRegistry.hasErrorCode('AUTH_TOKEN_EXPIRED_401');

// Get sorted error codes
const sorted = ErrorCodeRegistry.getSortedErrorCodes();
```

## Exception Mapper Registry

Maps exceptions to error codes:

```typescript
import { ExceptionMapperRegistry } from '@/error';

// Get mapping for exception
const mapping = ExceptionMapperRegistry.getMapping(exception);
// Returns: {
//   exceptionType: 'ValidationException',
//   errorCode: 'VALIDATION_INVALID_INPUT_400',
//   httpStatus: 400
// }

// Check if exception is mapped
const isMapped = ExceptionMapperRegistry.isMapped(exception);

// Get all mappings
const allMappings = ExceptionMapperRegistry.getAllMappings();
```

## Global Exception Filter

The `AppExceptionFilter` is registered globally in `main.ts`:

```typescript
import { AppExceptionFilter } from '@/error';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Register global exception filter
  app.useGlobalFilters(new AppExceptionFilter());
  
  await app.listen(3000);
}
```

## Testing Error Responses

### Test Deterministic Response Format

```typescript
import { ValidationException } from '@/error';

it('should return deterministic error response', () => {
  const exception = ValidationException.invalidInput({
    field: 'email'
  });

  expect(exception.toResponse()).toEqual({
    success: false,
    error: {
      code: 'VALIDATION_INVALID_INPUT_400',
      message: 'Invalid input data provided',
      details: { field: 'email' },
      requestId: expect.any(String),
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      retryable: false,
      severity: 'CLIENT',
      category: 'VALIDATION'
    }
  });
});
```

### Test Exception Filter Consistency

```typescript
import { AppExceptionFilter } from '@/error';

it('should produce consistent response for all error types', async () => {
  const filter = new AppExceptionFilter();
  
  const exceptions = [
    new ValidationException(),
    new AuthenticationException(),
    new Error('Generic error')
  ];

  exceptions.forEach(exception => {
    // All should have response.error with required fields
    expect(response.error).toHaveProperty('code');
    expect(response.error).toHaveProperty('message');
    expect(response.error).toHaveProperty('timestamp');
    expect(response.error).toHaveProperty('retryable');
    expect(response.error).toHaveProperty('severity');
    expect(response.error).toHaveProperty('category');
  });
});
```

## Integration with Middleware

Add middleware to initialize request context:

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RequestContextService } from '@/error';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private requestContext: RequestContextService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const requestId = 
      req.headers['x-request-id'] as string ||
      req.headers['x-correlation-id'] as string ||
      `req_${uuidv4()}`;

    // Add to response headers for client tracing
    res.setHeader('x-request-id', requestId);

    // Initialize context
    this.requestContext.initializeContext(requestId);

    // Clear context after response
    res.on('finish', () => {
      this.requestContext.clearContext();
    });

    next();
  }
}
```

Register in AppModule:

```typescript
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
```

## Acceptance Criteria Coverage

### ✅ Tests verify exact error responses
- Tests verify error code, message, status, and format
- Example: `deterministic-error-responses.spec.ts`

### ✅ Coverage includes all error paths
- StructuredException handling
- HttpException handling
- ValidationException handling
- Generic Error handling
- Unknown exception handling
- Exception mapping registry tests

### ✅ Standardized error format
- All responses include: code, message, timestamp, status, retryable
- Deterministic mapping from exceptions to codes
- Consistent response structure across all error types

### ✅ Global exception filter
- `AppExceptionFilter` catches all exceptions
- Normalizes all error responses
- Ensures consistency across API

### ✅ Error enums and registries
- `ErrorCategory` enum for classification
- `ErrorSeverity` enum for severity levels
- `ErrorCodeRegistry` for accessing error definitions
- `ExceptionMapperRegistry` for exception-to-code mapping
