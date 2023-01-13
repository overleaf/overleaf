#!/usr/bin/env node

'use strict'

const commandLineArgs = require('command-line-args')
const { chunkStore } = require('../')

async function deleteOldChunks(options) {
  const deletedChunksTotal = await chunkStore.deleteOldChunks(options)
  console.log(`Deleted ${deletedChunksTotal} old chunks`)
}

exports.deleteOldChunks = deleteOldChunks

if (require.main === module) {
  const options = commandLineArgs([
    { name: 'batch-size', type: Number },
    { name: 'max-batches', type: Number },
    { name: 'min-age', type: Number },
    { name: 'timeout', type: Number },
    { name: 'verbose', type: Boolean, alias: 'v', defaultValue: false },
  ])
  deleteOldChunks({
    batchSize: options['batch-size'],
    maxBatches: options['max-batches'],
    timeout: options.timeout,
    minAgeSecs: options['min-age'],
  })
    .then(() => {
      process.exit()
    })
    .catch(err => {
      console.error(err)
      process.exit(1)
    })
}
