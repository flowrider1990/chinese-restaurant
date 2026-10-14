import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

// ON DELETE set null added by hand: the generator omits it for ALTER TABLE ADD, and without it an
// image still assigned to a category could not be deleted from the media library.
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`menu_categories\` ADD \`image_id\` integer REFERENCES media(id) ON DELETE set null;`)
  await db.run(sql`CREATE INDEX \`menu_categories_image_idx\` ON \`menu_categories\` (\`image_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_menu_categories\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_order\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`INSERT INTO \`__new_menu_categories\`("id", "_order", "updated_at", "created_at") SELECT "id", "_order", "updated_at", "created_at" FROM \`menu_categories\`;`)
  await db.run(sql`DROP TABLE \`menu_categories\`;`)
  await db.run(sql`ALTER TABLE \`__new_menu_categories\` RENAME TO \`menu_categories\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`menu_categories__order_idx\` ON \`menu_categories\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`menu_categories_updated_at_idx\` ON \`menu_categories\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`menu_categories_created_at_idx\` ON \`menu_categories\` (\`created_at\`);`)
}
