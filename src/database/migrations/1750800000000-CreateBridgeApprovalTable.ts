import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the `bridge_approvals` table recording which signer approved each
 * cross-chain bridge transfer. The unique (bridgeId, signerId) constraint is
 * the database-level guarantee that one signer cannot reach the multisig
 * threshold alone, even under concurrent requests.
 */
export class CreateBridgeApprovalTable1750800000000 implements MigrationInterface {
  name = 'CreateBridgeApprovalTable1750800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "bridge_approvals" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "bridgeId" character varying NOT NULL,
        "signerId" character varying NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bridge_approvals" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_bridge_approval_bridge_signer" UNIQUE ("bridgeId", "signerId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_bridge_approvals_bridgeId" ON "bridge_approvals" ("bridgeId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_bridge_approvals_bridgeId"`);
    await queryRunner.query(`DROP TABLE "bridge_approvals"`);
  }
}
