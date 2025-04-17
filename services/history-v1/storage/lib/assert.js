'use strict'

const OError = require('@overleaf/o-error')

const check = require('check-types')
const { Blob } = require('overleaf-editor-core')

const assert = check.assert

const MONGO_ID_REGEXP = /^[0-9a-f]{24}$/
const POSTGRES_ID_REGEXP = /^[1-9][0-9]{0,9}$/
const MONGO_OR_POSTGRES_ID_REGEXP = /^([0-9a-f]{24}|[1-9][0-9]{0,9})$/

function transaction(transaction, message) {
  assert.function(transaction, message)
}

function blobHash(arg, message) {
  try {
    assert.match(arg, Blob.HEX_HASH_RX, message)
  } catch (error) {
    throw OError.tag(error, message, { arg })
  }
}

/**
 * A project id is a string that contains either an integer (for projects stored in Postgres) or 24
 * hex digits (for projects stored in Mongo)
 */
function projectId(arg, message) {
  try {
    assert.match(arg, MONGO_OR_POSTGRES_ID_REGEXP, message)
  } catch (error) {
    throw OError.tag(error, message, { arg })
  }
}

/**
 * A chunk id is a string that contains either an integer (for projects stored in Postgres) or 24
 * hex digits (for projects stored in Mongo)
 */
function chunkId(arg, message) {
  try {
    assert.match(arg, MONGO_OR_POSTGRES_ID_REGEXP, message)
  } catch (error) {
    throw OError.tag(error, message, { arg })
  }
}

function mongoId(arg, message) {
  try {
    assert.match(arg, MONGO_ID_REGEXP, message)
  } catch (error) {
    throw OError.tag(error, message, { arg })
  }
}

function postgresId(arg, message) {
  try {
    assert.match(arg, POSTGRES_ID_REGEXP, message)
  } catch (error) {
    throw OError.tag(error, message, { arg })
  }
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
