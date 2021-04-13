// Internal ticket: https://github.com/overleaf/issues/issues/4094

const Settings = require('settings-sharelatex')
const mongojs = require('mongojs')
const db = mongojs(Settings.mongo.url, ['deletedFiles'])

const INDEX_FILTER = { 'projectId_1': 1 }
const INDEX_OPTIONS = {
  key: {
    projectId: 1
  },
  background: 1
}

exports.migrate = (client, done) => {
  db.deletedFiles.ensureIndex(
    INDEX_FILTER,
    INDEX_OPTIONS,
    done
  )
}

exports.rollback = (client, done) => {
  db.deletedFiles.dropIndex(INDEX_FILTER, done)
}
