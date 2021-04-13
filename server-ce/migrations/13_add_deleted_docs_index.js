// Internal ticket: https://github.com/overleaf/issues/issues/4211

const Settings = require('settings-sharelatex')
const mongojs = require('mongojs')
const db = mongojs(Settings.mongo.url, ['docs'])

const INDEX_FILTER = { 'project_id_deleted_deletedAt_1': 1 }
const INDEX_OPTIONS = {
  key: {
    project_id: 1,
    deleted: 1,
    deletedAt: -1
  },
  background: 1
}

exports.migrate = (client, done) => {
  db.docs.ensureIndex(
    INDEX_FILTER,
    INDEX_OPTIONS,
    done
  )
}

exports.rollback = (client, done) => {
  db.docs.dropIndex(INDEX_FILTER, done)
}
