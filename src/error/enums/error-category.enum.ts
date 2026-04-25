/**
 * Error Categories for Deterministic Error Handling
 * Used for categorizing and routing errors to appropriate handlers
 */
export enum ErrorCategory {
  // Authentication & Authorization
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',

  // Validation
  VALIDATION = 'VALIDATION',
  INPUT = 'INPUT',

  // Business Logic
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  CONFLICT = 'CONFLICT',
  INSUFFICIENT_RESOURCES = 'INSUFFICIENT_RESOURCES',

  // Blockchain Operations
  BLOCKCHAIN = 'BLOCKCHAIN',
  NETWORK = 'NETWORK',

  // External Services
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  AI_SERVICE = 'AI_SERVICE',

  // Database Operations
  DATABASE = 'DATABASE',

  // Rate Limiting & Throttling
  RATE_LIMIT = 'RATE_LIMIT',

  // System
  SYSTEM = 'SYSTEM',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
