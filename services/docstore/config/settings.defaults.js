const http = require('node:http')
const https = require('node:https')

http.globalAgent.maxSockets = 300
http.globalAgent.keepAlive = false
https.globalAgent.keepAlive = false

const Settings = {
  internal: {
    docstore: {
      port: 3016,
      host: process.env.LISTEN_ADDRESS || '127.0.0.1',
    },
  },

  mongo: {
    options: {
      monitorCommands: true,
    },
  },

  docstore: {
    archiveOnSoftDelete: process.env.ARCHIVE_ON_SOFT_DELETE === 'true',
    keepSoftDeletedDocsArchived:
      process.env.KEEP_SOFT_DELETED_DOCS_ARCHIVED === 'true',

    backend: process.env.BACKEND,
    healthCheck: {
      project_id: process.env.HEALTH_CHECK_PROJECT_ID,
    },
    bucket: process.env.BUCKET_NAME || process.env.AWS_BUCKET || 'bucket',
    gcs: {
      unlockBeforeDelete: process.env.GCS_UNLOCK_BEFORE_DELETE === 'true',
      deletedBucketSuffix: process.env.GCS_DELETED_BUCKET_SUFFIX,
      deleteConcurrency: parseInt(process.env.GCS_DELETE_CONCURRENCY) || 50,
    },
  },

  max_deleted_docs: parseInt(process.env.MAX_DELETED_DOCS, 10) || 2000,

  max_doc_length: parseInt(process.env.MAX_DOC_LENGTH) || 2 * 1024 * 1024, // 2mb

  maxJsonRequestSize:
    parseInt(process.env.MAX_JSON_REQUEST_SIZE) || 6 * 1024 * 1024, // 6 MB

  unArchiveBatchSize: parseInt(process.env.UN_ARCHIVE_BATCH_SIZE, 10) || 50,
  parallelArchiveJobs: parseInt(process.env.PARALLEL_ARCHIVE_JOBS, 10) || 5,
  archivingLockDurationMs:
    parseInt(process.env.ARCHIVING_LOCK_DURATION_MS, 10) || 60000,
}

if (process.env.MONGO_CONNECTION_STRING) {
  Settings.mongo.url = process.env.MONGO_CONNECTION_STRING
} else if (process.env.MONGO_HOST) {
  Settings.mongo.url = `mongodb://${process.env.MONGO_HOST}/sharelatex`
} else {
  Settings.mongo.url = 'mongodb://127.0.0.1/sharelatex'
}

if (
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  process.env.AWS_BUCKET
) {
  Settings.docstore.s3 = {
    key: process.env.AWS_ACCESS_KEY_ID,
    secret: process.env.AWS_SECRET_ACCESS_KEY,
    bucket: process.env.AWS_BUCKET,
    endpoint: process.env.AWS_S3_ENDPOINT,
    pathStyle: process.env.AWS_S3_PATH_STYLE,
    partSize: parseInt(process.env.AWS_S3_PARTSIZE) || 100 * 1024 * 1024,
  }
}

if (process.env.GCS_API_ENDPOINT) {
  Settings.docstore.gcs.endpoint = {
    apiEndpoint: process.env.GCS_API_ENDPOINT,
    projectId: process.env.GCS_PROJECT_ID,
  }
}

if (process.env.FALLBACK_BACKEND) {
  Settings.docstore.fallback = {
    backend: process.env.FALLBACK_BACKEND,
    // mapping of bucket names on the fallback, to bucket names on the primary.
    // e.g. { myS3UserFilesBucketName: 'myGoogleUserFilesBucketName' }
    buckets: JSON.parse(process.env.FALLBACK_BUCKET_MAPPING || '{}'),
    copyOnMiss: process.env.COPY_ON_MISS === 'true',
  }
}

module.exports = Settings
