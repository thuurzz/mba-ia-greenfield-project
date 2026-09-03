import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateVideoViews1788397393200 implements MigrationInterface {
    name = 'CreateVideoViews1788397393200'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "video_views" ("id" SERIAL NOT NULL, "video_id" character varying(26) NOT NULL, "ip" character varying(45) NOT NULL, "viewed_at" TIMESTAMP NOT NULL DEFAULT NOW(), CONSTRAINT "PK_ff495d570215fc8f915a4c8dd08" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_video_views_dedup" ON "video_views" ("video_id", "ip", "viewed_at")`);
        await queryRunner.query(`ALTER TABLE "video_views" ADD CONSTRAINT "FK_video_views_video" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "video_views" DROP CONSTRAINT "FK_video_views_video"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_video_views_dedup"`);
        await queryRunner.query(`DROP TABLE "video_views"`);
    }
}