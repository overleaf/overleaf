import {
  db,
  READ_PREFERENCE_SECONDARY,
} from '../app/src/infrastructure/mongodb.js'
import _ from 'lodash'
import { formatTokenUsageStats } from '@overleaf/access-token-encryptor/scripts/helpers/format-usage-stats.js'
import { ensureMongoTimeout } from './helpers/env_variable_helper.mjs'

if (!process.env.MONGO_SOCKET_TIMEOUT) {
  const TEN_MINUTES = 1000 * 60 * 10
  ensureMongoTimeout(TEN_MINUTES)
}

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
      readPreference: READ_PREFERENCE_SECONDARY,
      projection,
    }
  )
  for await (const doc of cursor) {
    for (const [name, path] of Object.entries(paths)) {
      const blob = _.get(doc, path)
      if (!blob) continue
      // Schema: LABEL-VERSION:SALT:CIPHERTEXT:IV
      const [label] = blob.split(':')
      let [, version] = label.split('-')
      version = version || 'v2'

      const key = [name, version, collectionName, path, label].join(':')
      stats[key] = (stats[key] || 0) + 1
    }
  }
  return stats
}

async function main() {
  const STATS = {}
  for (const [collectionName, paths] of Object.entries(CASES)) {
    const stats = await count(collectionName, paths)
    Object.assign(STATS, stats)
  }

  formatTokenUsageStats(STATS)
}

try {
  await main()
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
