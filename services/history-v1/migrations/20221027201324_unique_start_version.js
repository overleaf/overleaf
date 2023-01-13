exports.config = {
  // CREATE INDEX CONCURRENTLY can't be run inside a transaction
  // If this migration fails in the middle, indexes and constraints will have
  // to be cleaned up manually.
  transaction: false,
}

exports.up = async function (knex) {
  await knex.raw(`
    ALTER TABLE chunks
    ADD CONSTRAINT chunks_start_version_non_negative
    CHECK (start_version IS NOT NULL AND start_version >= 0)
    NOT VALID
  `)
  await knex.raw(`
    ALTER TABLE chunks
    VALIDATE CONSTRAINT chunks_start_version_non_negative
  `)
  await knex.raw(`
    CREATE UNIQUE INDEX CONCURRENTLY index_chunks_on_doc_id_and_start_version
    ON chunks (doc_id, start_version)
  `)
  await knex.raw(`
    ALTER TABLE chunks
    ADD UNIQUE USING INDEX index_chunks_on_doc_id_and_start_version
  `)
}

exports.down = async function (knex) {
  await knex.raw(`
    ALTER TABLE chunks
    DROP CONSTRAINT IF EXISTS index_chunks_on_doc_id_and_start_version
  `)
  await knex.raw(`
    DROP INDEX IF EXISTS index_chunks_on_doc_id_and_start_version
  `)
  await knex.raw(`
    ALTER TABLE chunks
    DROP CONSTRAINT IF EXISTS chunks_start_version_non_negative
  `)
}
