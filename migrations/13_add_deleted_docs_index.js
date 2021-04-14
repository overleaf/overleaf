// Internal ticket: https://github.com/overleaf/issues/issues/4211

const Settings = require('settings-sharelatex')
const mongojs = require('mongojs')
const db = mongojs(Settings.mongo.url, ['docs'])

const INDEX_NAME = 'project_id_deleted_deletedAt_1'
const INDEX_KEYS = {
  project_id: 1,
  deleted: 1,
  deletedAt: -1
}
const INDEX_OPTIONS = {
  name: INDEX_NAME,
  background: 1
}

exports.migrate = (client, done) => {
  db.docs.ensureIndex(
    INDEX_KEYS,
    INDEX_OPTIONS,
    done
  )
}

exports.rollback = (client, done) => {
  db.docs.dropIndex(INDEX_NAME, done)
}
