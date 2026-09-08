import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSocialTables1788400101888 implements MigrationInterface {
    name = 'CreateSocialTables1788400101888'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "video_likes" ("id" SERIAL NOT NULL, "video_id" character varying(26) NOT NULL, "user_id" uuid NOT NULL, "is_like" boolean NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_video_likes_user_video" UNIQUE ("video_id", "user_id"), CONSTRAINT "PK_video_likes" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "comments" ("id" SERIAL NOT NULL, "video_id" character varying(26) NOT NULL, "user_id" uuid NOT NULL, "body" text NOT NULL, "parent_id" integer, "likes_count" integer NOT NULL DEFAULT '0', "dislikes_count" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_comments" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_comments_video" ON "comments" ("video_id", "created_at") `);
        await queryRunner.query(`CREATE TABLE "comment_likes" ("id" SERIAL NOT NULL, "comment_id" integer NOT NULL, "user_id" uuid NOT NULL, "is_like" boolean NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_comment_likes_user_comment" UNIQUE ("comment_id", "user_id"), CONSTRAINT "PK_comment_likes" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "subscriptions" ("id" SERIAL NOT NULL, "channel_id" uuid NOT NULL, "subscriber_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_subscriptions" UNIQUE ("channel_id", "subscriber_id"), CONSTRAINT "PK_subscriptions" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "channels" ADD "subscriber_count" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "videos" ADD "likes_count" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "videos" ADD "dislikes_count" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "comments" ADD CONSTRAINT "FK_comments_video" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comments" ADD CONSTRAINT "FK_comments_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comment_likes" ADD CONSTRAINT "FK_comment_likes_comment" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comment_likes" ADD CONSTRAINT "FK_comment_likes_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_subscriptions_channel" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_subscriptions_user" FOREIGN KEY ("subscriber_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "video_likes" ADD CONSTRAINT "FK_video_likes_video" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "video_likes" ADD CONSTRAINT "FK_video_likes_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "video_likes" DROP CONSTRAINT "FK_video_likes_user"`);
        await queryRunner.query(`ALTER TABLE "video_likes" DROP CONSTRAINT "FK_video_likes_video"`);
        await queryRunner.query(`ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_subscriptions_user"`);
        await queryRunner.query(`ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_subscriptions_channel"`);
        await queryRunner.query(`ALTER TABLE "comment_likes" DROP CONSTRAINT "FK_comment_likes_user"`);
        await queryRunner.query(`ALTER TABLE "comment_likes" DROP CONSTRAINT "FK_comment_likes_comment"`);
        await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_comments_user"`);
        await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_comments_video"`);
        await queryRunner.query(`ALTER TABLE "videos" DROP COLUMN "dislikes_count"`);
        await queryRunner.query(`ALTER TABLE "videos" DROP COLUMN "likes_count"`);
        await queryRunner.query(`ALTER TABLE "channels" DROP COLUMN "subscriber_count"`);
        await queryRunner.query(`DROP TABLE "subscriptions"`);
        await queryRunner.query(`DROP TABLE "comment_likes"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_comments_video"`);
        await queryRunner.query(`DROP TABLE "comments"`);
        await queryRunner.query(`DROP TABLE "video_likes"`);
    }
}