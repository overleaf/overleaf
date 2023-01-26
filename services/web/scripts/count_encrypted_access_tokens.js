const TEN_MINUTES = 1000 * 60 * 10
process.env.MONGO_SOCKET_TIMEOUT =
  process.env.MONGO_SOCKET_TIMEOUT || TEN_MINUTES.toString()

const { ReadPreference } = require('mongodb')
const { db, waitForDb } = require('../app/src/infrastructure/mongodb')
const _ = require('lodash')

const CASES = {
  users: {
    dropbox: 'dropbox.access_token_oauth2.encrypted',
    zotero: 'refProviders.zotero.encrypted',
    mendeley: 'refProviders.mendeley.encrypted',
  },
  githubSyncUserCredentials: {
    github: 'auth_token_encrypted',
  },
}

async function count(collectionName, paths) {
  const collection = db[collectionName]
  const stats = {}

  const projection = { _id: 0 }
  for (const path of Object.values(paths)) {
    projection[path] = 1
  }

  const cursor = collection.find(
    {},
    {
      readPreference: ReadPreference.SECONDARY,
      projection,
    }
  )
  for await (const doc of cursor) {
    for (const [name, path] of Object.entries(paths)) {
      const blob = _.get(doc, path)
      if (!blob) continue
      // Schema: LABEL:SALT:CIPHERTEXT:IV
      const [label, , , iv] = blob.split(':', 4)
      const version = iv ? 'v2' : 'v1'

      const key = [name, version, collectionName, path, label].join(':')
      stats[key] = (stats[key] || 0) + 1
    }
  }
  return stats
}

async function main() {
  await waitForDb()

  const STATS = {}
  for (const [collectionName, paths] of Object.entries(CASES)) {
    const stats = await count(collectionName, paths)
    Object.assign(STATS, stats)
  }

  const prettyStats = []
  const sortedStats = Object.entries(STATS).sort((a, b) =>
    a[0] > b[0] ? 1 : -1
  )
  const totalByName = {}
  for (const [key, n] of sortedStats) {
    const [name, version, collectionName, path, label] = key.split(':')
    totalByName[name] = (totalByName[name] || 0) + n
    prettyStats.push({ name, version, collectionName, path, label, n })
  }
  for (const row of prettyStats) {
    row.percentage = ((100 * row.n) / totalByName[row.name])
      .toFixed(2)
      .padStart(6)
  }
  console.table(prettyStats)
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
