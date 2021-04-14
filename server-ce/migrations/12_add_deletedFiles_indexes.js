// Internal ticket: https://github.com/overleaf/issues/issues/4094

const Settings = require('settings-sharelatex')
const mongojs = require('mongojs')
const db = mongojs(Settings.mongo.url, ['deletedFiles'])

const INDEX_NAME = 'projectId_1'
const INDEX_KEYS = { projectId: 1 }
const INDEX_OPTIONS = {
  name: INDEX_NAME,
  background: 1
}

exports.migrate = (client, done) => {
  db.deletedFiles.ensureIndex(
    INDEX_KEYS,
    INDEX_OPTIONS,
    done
  )
}

exports.rollback = (client, done) => {
  db.deletedFiles.dropIndex(INDEX_NAME, done)
}
