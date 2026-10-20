import type { Kysely } from "kysely";
import type { Migration, MigrationProvider } from "kysely/migration";

const migrations: Record<string, Migration> = {
  "2026_10_20_001_initial": {
    async up(db: Kysely<any>) {
      await db.schema
        .createTable("users")
        .addColumn("id", "text", (c) => c.primaryKey())
        .addColumn("email", "text", (c) => c.notNull().unique())
        .addColumn("password_hash", "text", (c) => c.notNull())
        .addColumn("first_name", "text", (c) => c.notNull().defaultTo(""))
        .addColumn("last_name", "text", (c) => c.notNull().defaultTo(""))
        .addColumn("display_name", "text")
        .addColumn("bio", "text")
        .addColumn("avatar_url", "text")
        .addColumn("is_admin", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("is_active", "integer", (c) => c.notNull().defaultTo(1))
        .addColumn("created_at", "text", (c) => c.notNull())
        .addColumn("updated_at", "text", (c) => c.notNull())
        .execute();

      await db.schema
        .createTable("sessions")
        .addColumn("id", "text", (c) => c.primaryKey())
        .addColumn("user_id", "text", (c) => c.notNull().references("users.id").onDelete("cascade"))
        .addColumn("expires_at", "text", (c) => c.notNull())
        .addColumn("created_at", "text", (c) => c.notNull())
        .execute();
      await db.schema.createIndex("sessions_user_idx").on("sessions").column("user_id").execute();

      await db.schema
        .createTable("invitations")
        .addColumn("id", "text", (c) => c.primaryKey())
        .addColumn("token_hash", "text", (c) => c.notNull().unique())
        .addColumn("email", "text", (c) => c.notNull())
        .addColumn("invited_by", "text", (c) => c.references("users.id").onDelete("set null"))
        .addColumn("message", "text")
        .addColumn("expires_at", "text", (c) => c.notNull())
        .addColumn("accepted_at", "text")
        .addColumn("created_at", "text", (c) => c.notNull())
        .execute();
      await db.schema.createIndex("invitations_email_idx").on("invitations").column("email").execute();

      await db.schema
        .createTable("password_resets")
        .addColumn("token_hash", "text", (c) => c.primaryKey())
        .addColumn("user_id", "text", (c) => c.notNull().references("users.id").onDelete("cascade"))
        .addColumn("expires_at", "text", (c) => c.notNull())
        .addColumn("used_at", "text")
        .addColumn("created_at", "text", (c) => c.notNull())
        .execute();

      await db.schema
        .createTable("site_settings")
        .addColumn("id", "integer", (c) => c.primaryKey())
        .addColumn("site_name", "text", (c) => c.notNull())
        .addColumn("tagline", "text")
        .addColumn("about", "text")
        .addColumn("hero_image_url", "text")
        .addColumn("contact_email", "text")
        .addColumn("updated_at", "text", (c) => c.notNull())
        .execute();
      await db
        .insertInto("site_settings")
        .values({ id: 1, site_name: "Northern Lights", updated_at: new Date().toISOString() })
        .execute();

      await db.schema
        .createTable("posts")
        .addColumn("id", "text", (c) => c.primaryKey())
        .addColumn("user_id", "text", (c) => c.notNull().references("users.id").onDelete("cascade"))
        .addColumn("content", "text", (c) => c.notNull().defaultTo(""))
        .addColumn("media_urls", "text", (c) => c.notNull().defaultTo("[]"))
        .addColumn("is_public", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("created_at", "text", (c) => c.notNull())
        .addColumn("updated_at", "text", (c) => c.notNull())
        .execute();
      await db.schema.createIndex("posts_created_idx").on("posts").column("created_at").execute();
      await db.schema.createIndex("posts_user_idx").on("posts").columns(["user_id", "created_at"]).execute();

      await db.schema
        .createTable("comments")
        .addColumn("id", "text", (c) => c.primaryKey())
        .addColumn("post_id", "text", (c) => c.notNull().references("posts.id").onDelete("cascade"))
        .addColumn("user_id", "text", (c) => c.notNull().references("users.id").onDelete("cascade"))
        .addColumn("content", "text", (c) => c.notNull())
        .addColumn("created_at", "text", (c) => c.notNull())
        .execute();
      await db.schema.createIndex("comments_post_idx").on("comments").columns(["post_id", "created_at"]).execute();

      await db.schema
        .createTable("reactions")
        .addColumn("id", "text", (c) => c.primaryKey())
        .addColumn("post_id", "text", (c) => c.notNull().references("posts.id").onDelete("cascade"))
        .addColumn("user_id", "text", (c) => c.notNull().references("users.id").onDelete("cascade"))
        .addColumn("type", "text", (c) => c.notNull().defaultTo("like"))
        .addColumn("created_at", "text", (c) => c.notNull())
        .addUniqueConstraint("reactions_user_post_uq", ["user_id", "post_id"])
        .execute();
      await db.schema.createIndex("reactions_post_idx").on("reactions").column("post_id").execute();

      await db.schema
        .createTable("messages")
        .addColumn("id", "text", (c) => c.primaryKey())
        .addColumn("sender_id", "text", (c) => c.notNull().references("users.id").onDelete("cascade"))
        .addColumn("recipient_id", "text", (c) => c.notNull().references("users.id").onDelete("cascade"))
        .addColumn("content", "text", (c) => c.notNull())
        .addColumn("read", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("created_at", "text", (c) => c.notNull())
        .execute();
      await db.schema.createIndex("messages_sender_idx").on("messages").columns(["sender_id", "created_at"]).execute();
      await db.schema.createIndex("messages_recipient_idx").on("messages").columns(["recipient_id", "created_at"]).execute();

      await db.schema
        .createTable("albums")
        .addColumn("id", "text", (c) => c.primaryKey())
        .addColumn("owner_id", "text", (c) => c.references("users.id").onDelete("set null"))
        .addColumn("title", "text", (c) => c.notNull())
        .addColumn("description", "text")
        .addColumn("cover_url", "text")
        .addColumn("is_public", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("created_at", "text", (c) => c.notNull())
        .addColumn("updated_at", "text", (c) => c.notNull())
        .execute();

      await db.schema
        .createTable("media")
        .addColumn("id", "text", (c) => c.primaryKey())
        .addColumn("user_id", "text", (c) => c.references("users.id").onDelete("set null"))
        .addColumn("album_id", "text", (c) => c.notNull().references("albums.id").onDelete("cascade"))
        .addColumn("url", "text", (c) => c.notNull())
        .addColumn("type", "text", (c) => c.notNull().defaultTo("image"))
        .addColumn("caption", "text")
        .addColumn("created_at", "text", (c) => c.notNull())
        .execute();
      await db.schema.createIndex("media_album_idx").on("media").columns(["album_id", "created_at"]).execute();
      await db.schema.createIndex("media_url_idx").on("media").column("url").execute();

      await db.schema
        .createTable("files")
        .addColumn("key", "text", (c) => c.primaryKey())
        .addColumn("owner_id", "text", (c) => c.references("users.id").onDelete("set null"))
        .addColumn("mime", "text", (c) => c.notNull())
        .addColumn("size", "integer", (c) => c.notNull())
        .addColumn("created_at", "text", (c) => c.notNull())
        .execute();
    },
  },
};

export const migrationProvider: MigrationProvider = {
  async getMigrations() {
    return migrations;
  },
};
