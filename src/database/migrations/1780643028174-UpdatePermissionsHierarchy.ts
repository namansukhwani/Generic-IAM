import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdatePermissionsHierarchy1780643028174 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM user_permission_overrides`);
    await queryRunner.query(`DELETE FROM role_permissions`);
    await queryRunner.query(`DELETE FROM permissions`);

    await queryRunner.query(`ALTER TABLE "permissions" DROP COLUMN "resource"`);
    await queryRunner.query(`ALTER TABLE "permissions" DROP COLUMN "action"`);

    await queryRunner.query(
      `ALTER TABLE "permissions" ADD "code" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "permissions" ADD "service" character varying NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "permissions" ADD "parent_id" uuid`);

    await queryRunner.query(
      `ALTER TABLE "permissions" ADD CONSTRAINT "UQ_permissions_code" UNIQUE ("code")`,
    );
    await queryRunner.query(
      `ALTER TABLE "permissions" ADD CONSTRAINT "FK_permissions_parent_id" FOREIGN KEY ("parent_id") REFERENCES "permissions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "permissions" DROP CONSTRAINT "FK_permissions_parent_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "permissions" DROP CONSTRAINT "UQ_permissions_code"`,
    );

    await queryRunner.query(
      `ALTER TABLE "permissions" DROP COLUMN "parent_id"`,
    );
    await queryRunner.query(`ALTER TABLE "permissions" DROP COLUMN "service"`);
    await queryRunner.query(`ALTER TABLE "permissions" DROP COLUMN "code"`);

    await queryRunner.query(
      `ALTER TABLE "permissions" ADD "action" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "permissions" ADD "resource" character varying NOT NULL`,
    );
  }
}
