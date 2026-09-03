import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPublishedAtToVideos1788309510238 implements MigrationInterface {
    name = 'AddPublishedAtToVideos1788309510238'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "videos" ADD "published_at" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "videos" DROP COLUMN "published_at"`);
    }

}
