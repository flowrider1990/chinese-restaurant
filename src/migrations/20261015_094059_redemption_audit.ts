import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

// Redemption audit fields (2026-10-15): staff choose "Eingelöst am/von"; the server stamps
// "Erfasst am/von". ON DELETE set null added by hand (the generator omits it for ALTER TABLE ADD;
// without it a user who recorded a redemption could not be deleted). Existing rows are backfilled
// with their redemption date and staff member, which the server stamped until now.
// Down rebuilds the table without the two columns (SQLite cannot drop a column with a foreign key).

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`vouchers_redemptions\` ADD \`recorded_at\` text;`)
  await db.run(
    sql`ALTER TABLE \`vouchers_redemptions\` ADD \`recorded_by_id\` integer REFERENCES users(id) ON DELETE set null;`,
  )
  await db.run(
    sql`CREATE INDEX \`vouchers_redemptions_recorded_by_idx\` ON \`vouchers_redemptions\` (\`recorded_by_id\`);`,
  )
  await db.run(
    sql`UPDATE \`vouchers_redemptions\` SET \`recorded_at\` = \`redeemed_at\`, \`recorded_by_id\` = \`by_id\` WHERE \`recorded_at\` IS NULL;`,
  )
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_vouchers_redemptions\` (
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
  await db.run(
    sql`INSERT INTO \`__new_vouchers_redemptions\`("_order", "_parent_id", "id", "amount", "note", "redeemed_at", "by_id") SELECT "_order", "_parent_id", "id", "amount", "note", "redeemed_at", "by_id" FROM \`vouchers_redemptions\`;`,
  )
  await db.run(sql`DROP TABLE \`vouchers_redemptions\`;`)
  await db.run(sql`ALTER TABLE \`__new_vouchers_redemptions\` RENAME TO \`vouchers_redemptions\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(
    sql`CREATE INDEX \`vouchers_redemptions_order_idx\` ON \`vouchers_redemptions\` (\`_order\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`vouchers_redemptions_parent_id_idx\` ON \`vouchers_redemptions\` (\`_parent_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`vouchers_redemptions_by_idx\` ON \`vouchers_redemptions\` (\`by_id\`);`,
  )
}
