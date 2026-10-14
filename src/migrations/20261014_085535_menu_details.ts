import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_site_settings_order_links\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`provider\` text DEFAULT 'other' NOT NULL,
  	\`url\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`site_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  // Generated SELECT referenced the new "provider" column; existing rows default to 'other'.
  await db.run(sql`INSERT INTO \`__new_site_settings_order_links\`("_order", "_parent_id", "id", "provider", "url") SELECT "_order", "_parent_id", "id", 'other', "url" FROM \`site_settings_order_links\`;`)
  await db.run(sql`DROP TABLE \`site_settings_order_links\`;`)
  await db.run(sql`ALTER TABLE \`__new_site_settings_order_links\` RENAME TO \`site_settings_order_links\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`site_settings_order_links_order_idx\` ON \`site_settings_order_links\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_order_links_parent_id_idx\` ON \`site_settings_order_links\` (\`_parent_id\`);`)
  await db.run(sql`ALTER TABLE \`menu_items\` ADD \`name_original\` text;`)
  await db.run(sql`ALTER TABLE \`menu_items\` ADD \`spiciness\` text;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_site_settings_order_links\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`url\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`site_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_site_settings_order_links\`("_order", "_parent_id", "id", "url") SELECT "_order", "_parent_id", "id", coalesce("url", '') FROM \`site_settings_order_links\`;`)
  await db.run(sql`DROP TABLE \`site_settings_order_links\`;`)
  await db.run(sql`ALTER TABLE \`__new_site_settings_order_links\` RENAME TO \`site_settings_order_links\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`site_settings_order_links_order_idx\` ON \`site_settings_order_links\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_order_links_parent_id_idx\` ON \`site_settings_order_links\` (\`_parent_id\`);`)
  await db.run(sql`ALTER TABLE \`menu_items\` DROP COLUMN \`name_original\`;`)
  await db.run(sql`ALTER TABLE \`menu_items\` DROP COLUMN \`spiciness\`;`)
}
