import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVideoEntity1788231706928 implements MigrationInterface {
  name = 'CreateVideoEntity1788231706928';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."videos_status_enum" AS ENUM('draft', 'uploading', 'processing', 'ready', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."videos_visibility_enum" AS ENUM('public', 'unlisted')`,
    );
    await queryRunner.query(
      `CREATE TABLE "videos" ("id" character varying(26) NOT NULL, "title" character varying(255), "description" text, "status" "public"."videos_status_enum" NOT NULL DEFAULT 'draft', "visibility" "public"."videos_visibility_enum" NOT NULL DEFAULT 'public', "channel_id" uuid NOT NULL, "category_id" integer, "duration" integer, "thumbnail_url" character varying(500), "storage_path" character varying(500), "hls_playlist_url" character varying(500), "original_file_name" character varying(255), "file_size" bigint, "mime_type" character varying(100), "view_count" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e4c86c0cf95aff16e9fb8220f6b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "videos" ADD CONSTRAINT "FK_023a8e4f3f1a34ff3d8ca04a4cc" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "videos" DROP CONSTRAINT "FK_023a8e4f3f1a34ff3d8ca04a4cc"`,
    );
    await queryRunner.query(`DROP TABLE "videos"`);
    await queryRunner.query(`DROP TYPE "public"."videos_visibility_enum"`);
    await queryRunner.query(`DROP TYPE "public"."videos_status_enum"`);
  }
}
