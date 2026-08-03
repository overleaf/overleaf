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
      // template_files keys are `templateId/v/version/fileId` (literal
      // 24-hex prefix). project_blobs keys are
      // `projectKey.format(historyId)/hash-prefix/hash-rest`, i.e. a
      // reversed, zero-padded historyId split into 3/3/rest digits (numeric
      // legacy ids) or 3/3/18 hex chars (reversed ObjectId hex) -- both
      // stores share this test bucket, so accept either shape. See
      // @overleaf/object-persistor/src/ProjectKey.js and
      // history-v1/storage/lib/backupPersistor.mjs's PROJECT_FOLDER_REGEX
      // for the same distinction in production.
      const rawId = path.match(/^[a-f0-9]{24}\//)
      if (rawId) return rawId[0]
      const reversedId = path.match(
        /^(?:\d{3}\/\d{3}\/\d{3,}|[a-f0-9]{3}\/[a-f0-9]{3}\/[a-f0-9]{18})\//
      )
      if (reversedId) return reversedId[0]
      throw new Error('not a project-folder')
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
  // project_blobs/global_blobs reuse the template_files bucket in tests --
  // buckets are just opaque containers keyed by an unrelated namespace, so
  // this is enough to exercise the routing/key-building/validation for the
  // history blob routes without provisioning dedicated test buckets.
  const templateFiles = process.env.AWS_S3_TEMPLATE_FILES_BUCKET_NAME
  return {
    template_files: templateFiles,
    project_blobs: templateFiles,
    global_blobs: templateFiles,
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
  // see s3Stores() above: reuse the same bucket for the history blob stores.
  const templateFiles = process.env.GCS_TEMPLATE_FILES_BUCKET_NAME
  return {
    template_files: templateFiles,
    project_blobs: templateFiles,
    global_blobs: templateFiles,
  }
}

function fsStores() {
  // see s3Stores() above: reuse the same directory for the history blob
  // stores.
  const templateFiles = Path.resolve(
    import.meta.dirname,
    '../../../template_files'
  )
  return {
    template_files: templateFiles,
    project_blobs: templateFiles,
    global_blobs: templateFiles,
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
