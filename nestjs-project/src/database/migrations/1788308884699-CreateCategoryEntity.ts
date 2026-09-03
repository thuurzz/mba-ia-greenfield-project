import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCategoryEntity1788308884699 implements MigrationInterface {
    name = 'CreateCategoryEntity1788308884699'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "categories" ("id" SERIAL NOT NULL, "name" character varying(50) NOT NULL, "slug" character varying(50) NOT NULL, "display_order" integer NOT NULL DEFAULT '0', CONSTRAINT "UQ_420d9f679d41281f282f5bc7d09" UNIQUE ("slug"), CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "categories"`);
    }

}