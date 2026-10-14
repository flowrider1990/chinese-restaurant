import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

// ON DELETE cascade added by hand for payload_locked_documents_rels.vouchers_id, matching the
// other document-lock columns; the generator omits it for ALTER TABLE ADD.

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`vouchers_redemptions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`amount\` numeric NOT NULL,
  	\`note\` text,
  	\`redeemed_at\` text,
  	\`by_id\` integer,
  	FOREIGN KEY (\`by_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`vouchers\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`vouchers_redemptions_order_idx\` ON \`vouchers_redemptions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`vouchers_redemptions_parent_id_idx\` ON \`vouchers_redemptions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`vouchers_redemptions_by_idx\` ON \`vouchers_redemptions\` (\`by_id\`);`)
  await db.run(sql`CREATE TABLE \`vouchers\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`code\` text,
  	\`amount\` numeric NOT NULL,
  	\`balance\` numeric,
  	\`status\` text DEFAULT 'pending' NOT NULL,
  	\`valid_until\` text,
  	\`paid_at\` text,
  	\`buyer_name\` text NOT NULL,
  	\`buyer_email\` text NOT NULL,
  	\`recipient_name\` text,
  	\`message\` text,
  	\`locale\` text DEFAULT 'de' NOT NULL,
  	\`stripe_session_id\` text,
  	\`stripe_payment_intent\` text,
  	\`privacy_accepted_at\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`vouchers_code_idx\` ON \`vouchers\` (\`code\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`vouchers_stripe_session_id_idx\` ON \`vouchers\` (\`stripe_session_id\`);`)
  await db.run(sql`CREATE INDEX \`vouchers_updated_at_idx\` ON \`vouchers\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`vouchers_created_at_idx\` ON \`vouchers\` (\`created_at\`);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`vouchers_id\` integer REFERENCES vouchers(id) ON DELETE cascade;`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_vouchers_id_idx\` ON \`payload_locked_documents_rels\` (\`vouchers_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`vouchers_redemptions\`;`)
  await db.run(sql`DROP TABLE \`vouchers\`;`)
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
  	\`reservations_id\` integer,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`menu_items_id\`) REFERENCES \`menu_items\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`menu_categories_id\`) REFERENCES \`menu_categories\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`attributes_id\`) REFERENCES \`attributes\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`posts_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`reservations_id\`) REFERENCES \`reservations\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_payload_locked_documents_rels\`("id", "order", "parent_id", "path", "menu_items_id", "menu_categories_id", "attributes_id", "posts_id", "media_id", "reservations_id", "users_id") SELECT "id", "order", "parent_id", "path", "menu_items_id", "menu_categories_id", "attributes_id", "posts_id", "media_id", "reservations_id", "users_id" FROM \`payload_locked_documents_rels\`;`)
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
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_reservations_id_idx\` ON \`payload_locked_documents_rels\` (\`reservations_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`)
}
