const Path = require('path')

// environment variables renamed for consistency
// use AWS_ACCESS_KEY_ID-style going forward
if (process.env.AWS_KEY && !process.env.AWS_ACCESS_KEY_ID) {
  process.env.AWS_ACCESS_KEY_ID = process.env.AWS_KEY
}
if (process.env.AWS_SECRET && !process.env.AWS_SECRET_ACCESS_KEY) {
  process.env.AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET
}

// pre-backend setting, fall back to old behaviour
if (process.env.BACKEND == null) {
  if (process.env.AWS_ACCESS_KEY_ID || process.env.S3_BUCKET_CREDENTIALS) {
    process.env.BACKEND = 's3'
    process.env.USER_FILES_BUCKET_NAME =
      process.env.AWS_S3_USER_FILES_BUCKET_NAME
    process.env.TEMPLATE_FILES_BUCKET_NAME =
      process.env.AWS_S3_TEMPLATE_FILES_BUCKET_NAME
    process.env.PUBLIC_FILES_BUCKET_NAME =
      process.env.AWS_S3_PUBLIC_FILES_BUCKET_NAME
  } else {
    process.env.BACKEND = 'fs'
    process.env.USER_FILES_BUCKET_NAME = Path.join(__dirname, '../user_files')
    process.env.TEMPLATE_FILES_BUCKET_NAME = Path.join(
      __dirname,
      '../template_files'
    )
    process.env.PUBLIC_FILES_BUCKET_NAME = Path.join(
      __dirname,
      '../public_files'
    )
  }
}

const settings = {
  internal: {
    filestore: {
      port: 3009,
      host: process.env.LISTEN_ADDRESS || 'localhost',
    },
  },

  filestore: {
    // Which backend persistor to use.
    // Choices are
    // s3 - Amazon S3
    // fs - local filesystem
    // gcs - Google Cloud Storage
    backend: process.env.BACKEND,

    gcs: {
      endpoint: process.env.GCS_API_ENDPOINT
        ? {
            apiEndpoint: process.env.GCS_API_ENDPOINT,
            projectId: process.env.GCS_PROJECT_ID,
          }
        : undefined,
      unlockBeforeDelete: process.env.GCS_UNLOCK_BEFORE_DELETE === 'true', // unlock an event-based hold before deleting. default false
      deletedBucketSuffix: process.env.GCS_DELETED_BUCKET_SUFFIX, // if present, copy file to another bucket on delete. default null
      deleteConcurrency: parseInt(process.env.GCS_DELETE_CONCURRENCY) || 50,
      signedUrlExpiryInMs: parseInt(process.env.LINK_EXPIRY_TIMEOUT || 60000),
    },

    s3:
      process.env.AWS_ACCESS_KEY_ID || process.env.S3_BUCKET_CREDENTIALS
        ? {
            key: process.env.AWS_ACCESS_KEY_ID,
            secret: process.env.AWS_SECRET_ACCESS_KEY,
            endpoint: process.env.AWS_S3_ENDPOINT,
            pathStyle: process.env.AWS_S3_PATH_STYLE,
            partSize: process.env.AWS_S3_PARTSIZE || 100 * 1024 * 1024,
            bucketCreds: process.env.S3_BUCKET_CREDENTIALS
              ? JSON.parse(process.env.S3_BUCKET_CREDENTIALS)
              : undefined,
          }
        : undefined,

    // GCS should be configured by the service account on the kubernetes pod. See GOOGLE_APPLICATION_CREDENTIALS,
    // which will be picked up automatically.

    stores: {
      user_files: process.env.USER_FILES_BUCKET_NAME,
      template_files: process.env.TEMPLATE_FILES_BUCKET_NAME,
      public_files: process.env.PUBLIC_FILES_BUCKET_NAME,
    },

    fallback: process.env.FALLBACK_BACKEND
      ? {
          backend: process.env.FALLBACK_BACKEND,
          // mapping of bucket names on the fallback, to bucket names on the primary.
          // e.g. { myS3UserFilesBucketName: 'myGoogleUserFilesBucketName' }
          buckets: JSON.parse(process.env.FALLBACK_BUCKET_MAPPING || '{}'),
          copyOnMiss: process.env.COPY_ON_MISS === 'true',
        }
      : undefined,

    allowRedirects: process.env.ALLOW_REDIRECTS === 'true',
  },

  path: {
    uploadFolder: Path.join(__dirname, '../uploads'),
  },

  commands: {
    // Any commands to wrap the convert utility in, for example ["nice"], or ["firejail", "--profile=/etc/firejail/convert.profile"]
    convertCommandPrefix: [],
  },

  enableConversions: process.env.ENABLE_CONVERSIONS === 'true',

  sentry: {
    dsn: process.env.SENTRY_DSN,
  },
}

// Filestore health check
// ----------------------
// Project and file details to check in persistor when calling /health_check
if (process.env.HEALTH_CHECK_PROJECT_ID && process.env.HEALTH_CHECK_FILE_ID) {
  settings.health_check = {
    project_id: process.env.HEALTH_CHECK_PROJECT_ID,
    file_id: process.env.HEALTH_CHECK_FILE_ID,
  }
}

module.exports = settings
