// @ts-check
import fs from 'node:fs'
import Path from 'node:path'
import _ from 'lodash'
import config from 'config'
import { SecretManagerServiceClient } from '@google-cloud/secret-manager'
import OError from '@overleaf/o-error'
import {
  PerProjectEncryptedS3Persistor,
  RootKeyEncryptionKey,
} from '@overleaf/object-persistor/src/PerProjectEncryptedS3Persistor.js'
import { HistoryStore } from './history_store.js'

const persistorConfig = _.cloneDeep(config.get('backupPersistor'))
const { chunksBucket, deksBucket, globalBlobsBucket, projectBlobsBucket } =
  config.get('backupStore')

export { chunksBucket, globalBlobsBucket, projectBlobsBucket }

function convertKey(key, convertFn) {
  if (_.has(persistorConfig, key)) {
    _.update(persistorConfig, key, convertFn)
  }
}

convertKey('s3SSEC.httpOptions.timeout', s => parseInt(s, 10))
convertKey('s3SSEC.maxRetries', s => parseInt(s, 10))
convertKey('s3SSEC.pathStyle', s => s === 'true')
// array of CA, either inlined or on disk
convertKey('s3SSEC.ca', s =>
  JSON.parse(s).map(ca => (ca.startsWith('/') ? fs.readFileSync(ca) : ca))
)

/** @type {() => Promise<string>} */
let getRawRootKeyEncryptionKeys

if ((process.env.NODE_ENV || 'production') === 'production') {
  ;[persistorConfig.s3SSEC.key, persistorConfig.s3SSEC.secret] = (
    await loadFromSecretsManager(
      process.env.BACKUP_AWS_CREDENTIALS || '',
      'BACKUP_AWS_CREDENTIALS'
    )
  ).split(':')
  getRawRootKeyEncryptionKeys = () =>
    loadFromSecretsManager(
      persistorConfig.keyEncryptionKeys,
      'BACKUP_KEY_ENCRYPTION_KEYS'
    )
} else {
  getRawRootKeyEncryptionKeys = () => persistorConfig.keyEncryptionKeys
}

export const DELETION_ONLY = persistorConfig.keyEncryptionKeys === 'none'
if (DELETION_ONLY) {
  // For Backup-deleter; should not encrypt or read data; deleting does not need key.
  getRawRootKeyEncryptionKeys = () => new Promise(_resolve => {})
}

const PROJECT_FOLDER_REGEX =
  /^\d{3}\/\d{3}\/\d{3,}\/|[0-9a-f]{3}\/[0-9a-f]{3}\/[0-9a-f]{18}\/$/

/**
 * @param {string} bucketName
 * @param {string} path
 * @return {string}
 */
export function pathToProjectFolder(bucketName, path) {
  switch (bucketName) {
    case deksBucket:
    case chunksBucket:
    case projectBlobsBucket:
      const projectFolder = Path.join(...path.split('/').slice(0, 3)) + '/'
      if (!PROJECT_FOLDER_REGEX.test(projectFolder)) {
        throw new OError('invalid project folder', { bucketName, path })
      }
      return projectFolder
    default:
      throw new Error(`${bucketName} does not store per-project files`)
  }
}

/**
 * @param {string} name
 * @param {string} label
 * @return {Promise<string>}
 */
async function loadFromSecretsManager(name, label) {
  const client = new SecretManagerServiceClient()
  const [version] = await client.accessSecretVersion({ name })
  if (!version.payload?.data) throw new Error(`empty secret: ${label}`)
  return version.payload.data.toString()
}

async function getRootKeyEncryptionKeys() {
  return JSON.parse(await getRawRootKeyEncryptionKeys()).map(
    ({ key, salt }) => {
      return new RootKeyEncryptionKey(
        Buffer.from(key, 'base64'),
        Buffer.from(salt, 'base64')
      )
    }
  )
}

export const backupPersistor = new PerProjectEncryptedS3Persistor({
  ...persistorConfig.s3SSEC,
  dataEncryptionKeyBucketName: deksBucket,
  pathToProjectFolder,
  getRootKeyEncryptionKeys,
  storageClass: {
    [deksBucket]: 'STANDARD',
    [chunksBucket]: persistorConfig.tieringStorageClass,
    [projectBlobsBucket]: persistorConfig.tieringStorageClass,
  },
})

export const backupHistoryStore = new HistoryStore(
  backupPersistor,
  chunksBucket
)
