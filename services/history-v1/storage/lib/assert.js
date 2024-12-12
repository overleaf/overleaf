'use strict'

const check = require('check-types')
const { Blob } = require('overleaf-editor-core')

const assert = check.assert

const MONGO_ID_REGEXP = /^[0-9a-f]{24}$/
const POSTGRES_ID_REGEXP = /^[1-9][0-9]{0,9}$/
const PROJECT_ID_REGEXP = /^([0-9a-f]{24}|[1-9][0-9]{0,9})$/

function transaction(transaction, message) {
  assert.function(transaction, message)
}

function blobHash(arg, message) {
  assert.match(arg, Blob.HEX_HASH_RX, message)
}

/**
 * A chunk id is a string that contains either an integer (for projects stored in Postgres) or 24
 * hex digits (for projects stored in Mongo)
 */
function projectId(arg, message) {
  assert.match(arg, PROJECT_ID_REGEXP, message)
}

/**
 * A chunk id is either a number (for projects stored in Postgres) or a 24
 * character string (for projects stored in Mongo)
 */
function chunkId(arg, message) {
  const valid = check.integer(arg) || check.match(arg, MONGO_ID_REGEXP)
  if (!valid) {
    throw new TypeError(message)
  }
}

function mongoId(arg, message) {
  assert.match(arg, MONGO_ID_REGEXP)
}

function postgresId(arg, message) {
  assert.match(arg, POSTGRES_ID_REGEXP, message)
}

module.exports = {
  ...assert,
  transaction,
  blobHash,
  projectId,
  chunkId,
  mongoId,
  postgresId,
  MONGO_ID_REGEXP,
  POSTGRES_ID_REGEXP,
}
