exports.up = async function (knex) {
  await knex.raw(`
    ALTER TABLE chunks ADD COLUMN start_version integer
  `)
  await knex.raw(`
    ALTER TABLE pending_chunks ADD COLUMN start_version integer
  `)
  await knex.raw(`
    ALTER TABLE old_chunks ADD COLUMN start_version integer
  `)
}

exports.down = async function (knex) {
  await knex.raw(`
    ALTER TABLE chunks DROP COLUMN start_version
  `)
  await knex.raw(`
    ALTER TABLE pending_chunks DROP COLUMN start_version
  `)
  await knex.raw(`
    ALTER TABLE old_chunks DROP COLUMN start_version
  `)
}
