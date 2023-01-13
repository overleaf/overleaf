'use strict'

const BPromise = require('bluebird')
const dbSpecs = require('../fixtures').dbSpecs
const knex = require('../../../../../storage').knex
const historyStore = require('../../../../../storage').historyStore

function createFixtures() {
  return knex('chunks')
    .insert(dbSpecs.chunks)
    .then(() => {
      return BPromise.mapSeries(dbSpecs.histories, history =>
        historyStore.storeRaw(history.projectId, history.chunkId, history.json)
      )
    })
}

exports.create = createFixtures
exports.chunks = require('../fixtures/chunks').chunks
exports.docs = require('../fixtures/docs').docs
