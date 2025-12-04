import fs from 'node:fs'
import Path from 'node:path'
import crypto from 'node:crypto'
import { RootKeyEncryptionKey } from '@overleaf/object-persistor/src/PerProjectEncryptedS3Persistor.js'

const AWS_S3_USER_FILES_STORAGE_CLASS =
  process.env.AWS_S3_USER_FILES_STORAGE_CLASS

// use functions to get a fresh copy, not a reference, each time
function s3BaseConfig() {
  return {
    endpoint: process.env.AWS_S3_ENDPOINT,
    pathStyle: true,
    partSize: 100 * 1024 * 1024,
    ca: [fs.readFileSync('/certs/public.crt')],
  }
}

function s3Config() {
  return {
    key: process.env.AWS_ACCESS_KEY_ID,
    secret: process.env.AWS_SECRET_ACCESS_KEY,
    ...s3BaseConfig(),
  }
}

const S3SSECKeys = [
  new RootKeyEncryptionKey(
    crypto.generateKeySync('aes', { length: 256 }).export(),
    Buffer.alloc(32)
  ),
]

function s3SSECConfig() {
  return {
    ...s3Config(),
    ignoreErrorsFromDEKReEncryption: false,
    automaticallyRotateDEKEncryption: true,
    dataEncryptionKeyBucketName: process.env.AWS_S3_USER_FILES_DEK_BUCKET_NAME,
    pathToProjectFolder(_bucketName, path) {
      const match = path.match(/^[a-f0-9]{24}\//)
      if (!match) throw new Error('not a project-folder')
      const [projectFolder] = match
      return projectFolder
    },
    async getRootKeyEncryptionKeys() {
      return S3SSECKeys
    },
    storageClass: {
      [process.env.AWS_S3_TEMPLATE_FILES_BUCKET_NAME]:
        AWS_S3_USER_FILES_STORAGE_CLASS,
    },
  }
}

function s3ConfigDefaultProviderCredentials() {
  return {
    ...s3BaseConfig(),
  }
}

function s3Stores() {
  return {
    template_files: process.env.AWS_S3_TEMPLATE_FILES_BUCKET_NAME,
  }
}

function gcsConfig() {
  return {
    endpoint: {
      apiEndpoint: process.env.GCS_API_ENDPOINT,
      projectId: 'fake',
    },
    directoryKeyRegex: /^[0-9a-fA-F]{24}\/[0-9a-fA-F]{24}/,
    unlockBeforeDelete: false, // fake-gcs does not support this
    deletedBucketSuffix: '-deleted',
  }
}

function gcsStores() {
  return {
    template_files: process.env.GCS_TEMPLATE_FILES_BUCKET_NAME,
  }
}

function fsStores() {
  return {
    template_files: Path.resolve(
      import.meta.dirname,
      '../../../template_files'
    ),
  }
}

function fallbackStores(primaryConfig, fallbackConfig) {
  return {
    [primaryConfig.template_files]: fallbackConfig.template_files,
  }
}

const BackendSettings = {
  SHARD_01_FSPersistor: {
    backend: 'fs',
    stores: fsStores(),
  },
  SHARD_01_S3Persistor: {
    backend: 's3',
    s3: s3Config(),
    stores: s3Stores(),
  },
  SHARD_01_S3PersistorDefaultProviderCredentials: {
    backend: 's3',
    s3: s3ConfigDefaultProviderCredentials(),
    stores: s3Stores(),
  },
  SHARD_01_GcsPersistor: {
    backend: 'gcs',
    gcs: gcsConfig(),
    stores: gcsStores(),
  },
  SHARD_01_PerProjectEncryptedS3Persistor: {
    backend: 's3SSEC',
    s3SSEC: s3SSECConfig(),
    stores: s3Stores(),
  },
  SHARD_02_FallbackS3ToFSPersistor: {
    backend: 's3',
    s3: s3Config(),
    stores: s3Stores(),
    fallback: {
      backend: 'fs',
      buckets: fallbackStores(s3Stores(), fsStores()),
    },
  },
  SHARD_02_FallbackFSToS3Persistor: {
    backend: 'fs',
    s3: s3Config(),
    stores: fsStores(),
    fallback: {
      backend: 's3',
      buckets: fallbackStores(fsStores(), s3Stores()),
    },
  },
  SHARD_03_FallbackGcsToS3Persistor: {
    backend: 'gcs',
    gcs: gcsConfig(),
    stores: gcsStores(),
    s3: s3Config(),
    fallback: {
      backend: 's3',
      buckets: fallbackStores(gcsStores(), s3Stores()),
    },
  },
  SHARD_03_FallbackS3ToGcsPersistor: {
    backend: 's3',
    // can use the same bucket names for gcs and s3 (in tests)
    stores: s3Stores(),
    s3: s3Config(),
    gcs: gcsConfig(),
    fallback: {
      backend: 'gcs',
      buckets: fallbackStores(s3Stores(), gcsStores()),
    },
  },
}

function checkForUnexpectedTestFile() {
  const awareOfSharding = [
    'FilestoreApp.js',
    'FilestoreTests.js',
    'TestConfig.js',
    'TestHelper.js',
  ]
  for (const file of fs.readdirSync(import.meta.dirname).sort()) {
    if (!awareOfSharding.includes(file)) {
      throw new Error(
        `Found new test file ${file}: All tests must be aware of the SHARD_ prefix.`
      )
    }
  }
}
checkForUnexpectedTestFile()

export default {
  AWS_S3_USER_FILES_STORAGE_CLASS,
  BackendSettings,
  s3Config,
  s3SSECConfig,
}
