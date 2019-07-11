const mongojs = require('../../app/src/infrastructure/mongojs')
const { db } = mongojs

const keys = { 'tokens.readAndWritePrefix': 1 }
const opts = {
  unique: true,
  partialFilterExpression: {
    'tokens.readAndWritePrefix': { $exists: true }
  },
  background: true
}

console.log(
  `>> Creating index on ${JSON.stringify(keys)}, ${JSON.stringify(opts)}`
)

db.projects.createIndex(keys, opts, err => {
  if (err) {
    throw err
  }
  console.log('>> done')
  process.exit(0)
})
