'use strict'

const DocFixtures = require('./docs').docs

exports.chunks = {
  chunkOne: {
    id: 1000000,
    doc_id: DocFixtures.initializedProject.id,
    start_version: 0,
    end_version: 1,
    end_timestamp: new Date('2032-01-01'),
  },
}

exports.histories = {
  chunkOne: {
    projectId: DocFixtures.initializedProject.id,
    chunkId: '1000000',
    json: { snapshot: { files: {} }, changes: [] },
  },
}
