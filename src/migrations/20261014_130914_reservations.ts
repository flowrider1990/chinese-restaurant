import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

// ON DELETE cascade added by hand for payload_locked_documents_rels.reservations_id, matching the
// other document-lock columns; the generator omits it for ALTER TABLE ADD.
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`reservations\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`date\` text NOT NULL,
  	\`time\` text NOT NULL,
  	\`party_size\` numeric NOT NULL,
  	\`status\` text DEFAULT 'requested' NOT NULL,
  	\`message_to_guest\` text,
  	\`name\` text,
  	\`email\` text,
  	\`phone\` text,
  	\`note\` text,
  	\`locale\` text DEFAULT 'de' NOT NULL,
  	\`source\` text DEFAULT 'admin' NOT NULL,
  	\`starts_at\` text,
  	\`privacy_accepted_at\` text,
  	\`anonymised_at\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`reservations_updated_at_idx\` ON \`reservations\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`reservations_created_at_idx\` ON \`reservations\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`reservation_settings\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`mode\` text DEFAULT 'form' NOT NULL,
  	\`external_url\` text,
  	\`slot_minutes\` numeric DEFAULT 15 NOT NULL,
  	\`lead_time_minutes\` numeric DEFAULT 60 NOT NULL,
  	\`last_booking_before_close_minutes\` numeric DEFAULT 60 NOT NULL,
  	\`horizon_days\` numeric DEFAULT 60 NOT NULL,
  	\`max_party_size\` numeric DEFAULT 8 NOT NULL,
  	\`retention_days\` numeric DEFAULT 30 NOT NULL,
  	\`notification_email\` text,
  	\`updated_at\` text,
  	\`created_at\` text
  );
  `)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`reservations_id\` integer REFERENCES reservations(id) ON DELETE cascade;`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_reservations_id_idx\` ON \`payload_locked_documents_rels\` (\`reservations_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`reservations\`;`)
  await db.run(sql`DROP TABLE \`reservation_settings\`;`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_payload_locked_documents_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`menu_items_id\` integer,
  	\`menu_categories_id\` integer,
  	\`attributes_id\` integer,
  	\`posts_id\` integer,
  	\`media_id\` integer,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`menu_items_id\`) REFERENCES \`menu_items\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`menu_categories_id\`) REFERENCES \`menu_categories\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`attributes_id\`) REFERENCES \`attributes\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`posts_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_payload_locked_documents_rels\`("id", "order", "parent_id", "path", "menu_items_id", "menu_categories_id", "attributes_id", "posts_id", "media_id", "users_id") SELECT "id", "order", "parent_id", "path", "menu_items_id", "menu_categories_id", "attributes_id", "posts_id", "media_id", "users_id" FROM \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_payload_locked_documents_rels\` RENAME TO \`payload_locked_documents_rels\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_menu_items_id_idx\` ON \`payload_locked_documents_rels\` (\`menu_items_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_menu_categories_id_idx\` ON \`payload_locked_documents_rels\` (\`menu_categories_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_attributes_id_idx\` ON \`payload_locked_documents_rels\` (\`attributes_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_posts_id_idx\` ON \`payload_locked_documents_rels\` (\`posts_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`)
}
