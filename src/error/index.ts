// Errors
export { StructuredException } from './errors/structured.exception';

// Exceptions
export { AuthenticationException } from './exceptions/authentication.exception';
export { ValidationException } from './exceptions/validation.exception';
export { BlockchainException } from './exceptions/blockchain.exception';
export { AIServiceException } from './exceptions/ai-service.exception';

// Filters
export { AppExceptionFilter } from './filters/app-exception.filter';

// Constants
export { ERROR_CODES } from './constants/error-codes';
export type { ErrorCode } from './constants/error-codes';

// Registry
export { ErrorCodeRegistry } from './error-code.registry';

// Module
export { ErrorModule } from './error.module';