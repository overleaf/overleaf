const { ReadPreference } = require('mongodb')
const _ = require('lodash')
const { formatTokenUsageStats } = require('./format-usage-stats')

const LOG_EVERY_IN_S = parseInt(process.env.LOG_EVERY_IN_S || '5', 10)
const DRY_RUN = !process.argv.includes('--dry-run=false')

/**
 * @param {AccessTokenEncryptor} accessTokenEncryptor
 * @param {string} encryptedJson
 * @return {Promise<string>}
 */
async function reEncryptTokens(accessTokenEncryptor, encryptedJson) {
  return new Promise((resolve, reject) => {
    accessTokenEncryptor.decryptToJson(encryptedJson, (err, json) => {
      if (err) return reject(err)
      accessTokenEncryptor.encryptJson(json, (err, reEncryptedJson) => {
        if (err) return reject(err)
        resolve(reEncryptedJson)
      })
    })
  })
}

/**
 * @param {AccessTokenEncryptor} accessTokenEncryptor
 * @param {Collection} collection
 * @param {Object} paths
 * @return {Promise<{}>}
 */
async function reEncryptTokensInCollection({
  accessTokenEncryptor,
  collection,
  paths,
}) {
  const { collectionName } = collection
  const stats = {}

  let processed = 0
  let updatedNUsers = 0
  let lastLog = 0
  const logProgress = () => {
    if (DRY_RUN) {
      console.warn(
        `processed ${processed} | Would have updated ${updatedNUsers} users`
      )
    } else {
      console.warn(`processed ${processed} | Updated ${updatedNUsers} users`)
    }
  }

  const projection = { _id: 1 }
  for (const path of Object.values(paths)) {
    projection[path] = 1
  }
  const cursor = collection.find(
    {},
    {
      readPreference: ReadPreference.secondaryPreferred,
      projection,
    }
  )

  for await (const doc of cursor) {
    processed++

    let update = null
    for (const [name, path] of Object.entries(paths)) {
      const blob = _.get(doc, path)
      if (!blob) continue
      // Schema: LABEL-VERSION:SALT:CIPHERTEXT:IV
      const [label] = blob.split(':')
      let [, version] = label.split('-')
      version = version || 'v2'

      const key = [name, version, collectionName, path, label].join(':')
      stats[key] = (stats[key] || 0) + 1

      if (version === 'v2') {
        update = update || {}
        update[path] = await reEncryptTokens(accessTokenEncryptor, blob)
      }
    }

    if (Date.now() - lastLog >= LOG_EVERY_IN_S * 1000) {
      logProgress()
      lastLog = Date.now()
    }
    if (update) {
      updatedNUsers++

      const { _id } = doc
      if (DRY_RUN) {
        console.log('Would upgrade tokens for user', _id, Object.keys(update))
      } else {
        console.log('Upgrading tokens for user', _id, Object.keys(update))
        await collection.updateOne({ _id }, { $set: update })
      }
    }
  }
  logProgress()
  formatTokenUsageStats(stats)
}

module.exports = {
  reEncryptTokensInCollection,
}
