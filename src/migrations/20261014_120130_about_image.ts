import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

// ON DELETE set null added by hand: the generator omits it for ALTER TABLE ADD, and without it an
// image still shown on the restaurant page could not be deleted from the media library.
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`about\` ADD \`image_id\` integer REFERENCES media(id) ON DELETE set null;`)
  await db.run(sql`CREATE INDEX \`about_image_idx\` ON \`about\` (\`image_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_about\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`updated_at\` text,
  	\`created_at\` text
  );
  `)
  await db.run(sql`INSERT INTO \`__new_about\`("id", "updated_at", "created_at") SELECT "id", "updated_at", "created_at" FROM \`about\`;`)
  await db.run(sql`DROP TABLE \`about\`;`)
  await db.run(sql`ALTER TABLE \`__new_about\` RENAME TO \`about\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
}
