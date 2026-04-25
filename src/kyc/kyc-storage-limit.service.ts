import { Injectable, BadRequestException } from '@nestjs/common';

const MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_DOCUMENTS_PER_USER = 10;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

export interface KycDocumentMeta {
  mimeType: string;
  sizeBytes: number;
}

@Injectable()
export class KycStorageLimitService {
  validateDocument(doc: KycDocumentMeta): void {
    if (!ALLOWED_MIME_TYPES.includes(doc.mimeType)) {
      throw new BadRequestException(
        `Unsupported file type "${doc.mimeType}". Allowed: ${ALLOWED_MIME_TYPES.join(', ')}.`,
      );
    }

    if (doc.sizeBytes > MAX_DOCUMENT_SIZE_BYTES) {
      throw new BadRequestException(
        `File size ${doc.sizeBytes} bytes exceeds the ${MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024)} MB limit.`,
      );
    }
  }

  assertDocumentQuota(existingCount: number): void {
    if (existingCount >= MAX_DOCUMENTS_PER_USER) {
      throw new BadRequestException(
        `KYC document quota reached (max ${MAX_DOCUMENTS_PER_USER} per user). Remove an existing document before uploading a new one.`,
      );
    }
  }
}
