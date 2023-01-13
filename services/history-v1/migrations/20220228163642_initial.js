/**
 * This is the initial migration, meant to replicate the current state of the
 * history database. If tables already exist, this migration is a noop.
 */

exports.up = async function (knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS chunks (
      id SERIAL,
      doc_id integer NOT NULL,
      end_version integer NOT NULL,
      end_timestamp timestamp without time zone,
      CONSTRAINT chunks_version_non_negative CHECK (end_version >= 0)
    )
  `)
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS index_chunks_on_doc_id_and_end_version
    ON chunks (doc_id, end_version)
  `)

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS old_chunks (
      chunk_id integer NOT NULL PRIMARY KEY,
      doc_id integer NOT NULL,
      end_version integer,
      end_timestamp timestamp without time zone,
      deleted_at timestamp without time zone
    )
  `)
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS index_old_chunks_on_doc_id_and_end_version
    ON old_chunks (doc_id, end_version)
  `)

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS pending_chunks (
      id SERIAL,
      doc_id integer NOT NULL,
      end_version integer NOT NULL,
      end_timestamp timestamp without time zone,
      CONSTRAINT chunks_version_non_negative CHECK (end_version >= 0)
    )
  `)
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS index_pending_chunks_on_doc_id_and_id
    ON pending_chunks (doc_id, id)
  `)

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS blobs (
      hash_bytes bytea NOT NULL PRIMARY KEY,
      byte_length integer NOT NULL,
      string_length integer,
      global boolean,
      CONSTRAINT blobs_byte_length_non_negative CHECK (byte_length >= 0),
      CONSTRAINT blobs_string_length_non_negative
        CHECK (string_length IS NULL OR string_length >= 0)
    )
  `)

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS project_blobs (
      project_id integer NOT NULL,
      hash_bytes bytea NOT NULL,
      byte_length integer NOT NULL,
      string_length integer,
      PRIMARY KEY (project_id, hash_bytes),
      CONSTRAINT project_blobs_byte_length_non_negative
        CHECK (byte_length >= 0),
      CONSTRAINT project_blobs_string_length_non_negative
        CHECK (string_length IS NULL OR string_length >= 0)
    )
  `)

  await knex.raw(`CREATE SEQUENCE IF NOT EXISTS docs_id_seq`)
}

exports.down = async function (knex) {
  // Don't do anything on the down migration
}
