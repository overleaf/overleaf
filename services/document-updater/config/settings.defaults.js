const http = require('node:http')
const https = require('node:https')

http.globalAgent.keepAlive = false
https.globalAgent.keepAlive = false

module.exports = {
  internal: {
    documentupdater: {
      host: process.env.LISTEN_ADDRESS || '127.0.0.1',
      port: 3003,
    },
  },

  apis: {
    web: {
      url: `http://${
        process.env.WEB_API_HOST || process.env.WEB_HOST || '127.0.0.1'
      }:${process.env.WEB_API_PORT || process.env.WEB_PORT || 3000}`,
      user: process.env.WEB_API_USER || 'overleaf',
      pass: process.env.WEB_API_PASSWORD || 'password',
    },
    project_history: {
      url: `http://${process.env.PROJECT_HISTORY_HOST || '127.0.0.1'}:3054`,
    },
  },

  redis: {
    pubsub: {
      host:
        process.env.PUBSUB_REDIS_HOST || process.env.REDIS_HOST || '127.0.0.1',
      port: process.env.PUBSUB_REDIS_PORT || process.env.REDIS_PORT || '6379',
      password:
        process.env.PUBSUB_REDIS_PASSWORD || process.env.REDIS_PASSWORD || '',
      maxRetriesPerRequest: parseInt(
        process.env.REDIS_MAX_RETRIES_PER_REQUEST || '20'
      ),
    },

    history: {
      port: process.env.HISTORY_REDIS_PORT || process.env.REDIS_PORT || '6379',
      host:
        process.env.HISTORY_REDIS_HOST || process.env.REDIS_HOST || '127.0.0.1',
      password:
        process.env.HISTORY_REDIS_PASSWORD || process.env.REDIS_PASSWORD || '',
      maxRetriesPerRequest: parseInt(
        process.env.REDIS_MAX_RETRIES_PER_REQUEST || '20'
      ),
    },

    project_history: {
      port: process.env.HISTORY_REDIS_PORT || process.env.REDIS_PORT || '6379',
      host:
        process.env.HISTORY_REDIS_HOST || process.env.REDIS_HOST || '127.0.0.1',
      password:
        process.env.HISTORY_REDIS_PASSWORD || process.env.REDIS_PASSWORD || '',
      maxRetriesPerRequest: parseInt(
        process.env.REDIS_MAX_RETRIES_PER_REQUEST || '20'
      ),
      key_schema: {
        projectHistoryOps({ project_id: projectId }) {
          return `ProjectHistory:Ops:{${projectId}}`
        },
        projectHistoryFirstOpTimestamp({ project_id: projectId }) {
          return `ProjectHistory:FirstOpTimestamp:{${projectId}}`
        },
      },
    },

    lock: {
      port: process.env.LOCK_REDIS_PORT || process.env.REDIS_PORT || '6379',
      host:
        process.env.LOCK_REDIS_HOST || process.env.REDIS_HOST || '127.0.0.1',
      password:
        process.env.LOCK_REDIS_PASSWORD || process.env.REDIS_PASSWORD || '',
      maxRetriesPerRequest: parseInt(
        process.env.REDIS_MAX_RETRIES_PER_REQUEST || '20'
      ),
      key_schema: {
        blockingKey({ doc_id: docId }) {
          return `Blocking:{${docId}}`
        },
      },
    },

    documentupdater: {
      port:
        process.env.DOC_UPDATER_REDIS_PORT || process.env.REDIS_PORT || '6379',
      host:
        process.env.DOC_UPDATER_REDIS_HOST ||
        process.env.REDIS_HOST ||
        '127.0.0.1',
      password:
        process.env.DOC_UPDATER_REDIS_PASSWORD ||
        process.env.REDIS_PASSWORD ||
        '',
      maxRetriesPerRequest: parseInt(
        process.env.REDIS_MAX_RETRIES_PER_REQUEST || '20'
      ),
      key_schema: {
        blockingKey({ doc_id: docId }) {
          return `Blocking:{${docId}}`
        },
        docLines({ doc_id: docId }) {
          return `doclines:{${docId}}`
        },
        docOps({ doc_id: docId }) {
          return `DocOps:{${docId}}`
        },
        docVersion({ doc_id: docId }) {
          return `DocVersion:{${docId}}`
        },
        docHash({ doc_id: docId }) {
          return `DocHash:{${docId}}`
        },
        projectKey({ doc_id: docId }) {
          return `ProjectId:{${docId}}`
        },
        docsInProject({ project_id: projectId }) {
          return `DocsIn:{${projectId}}`
        },
        ranges({ doc_id: docId }) {
          return `Ranges:{${docId}}`
        },
        unflushedTime({ doc_id: docId }) {
          return `UnflushedTime:{${docId}}`
        },
        pathname({ doc_id: docId }) {
          return `Pathname:{${docId}}`
        },
        projectHistoryId({ doc_id: docId }) {
          return `ProjectHistoryId:{${docId}}`
        },
        projectState({ project_id: projectId }) {
          return `ProjectState:{${projectId}}`
        },
        projectBlock({ project_id: projectId }) {
          return `ProjectBlock:{${projectId}}`
        },
        pendingUpdates({ doc_id: docId }) {
          return `PendingUpdates:{${docId}}`
        },
        lastUpdatedBy({ doc_id: docId }) {
          return `lastUpdatedBy:{${docId}}`
        },
        lastUpdatedAt({ doc_id: docId }) {
          return `lastUpdatedAt:{${docId}}`
        },
        resolvedCommentIds({ doc_id: docId }) {
          return `ResolvedCommentIds:{${docId}}`
        },
        flushAndDeleteQueue() {
          return 'DocUpdaterFlushAndDeleteQueue'
        },
        historyRangesSupport() {
          return 'HistoryRangesSupport'
        },
      },
    },
  },

  max_doc_length: 2 * 1024 * 1024, // 2mb
  maxJsonRequestSize:
    parseInt(process.env.MAX_JSON_REQUEST_SIZE, 10) || 8 * 1024 * 1024,

  dispatcherCount: parseInt(process.env.DISPATCHER_COUNT || 10, 10),

  redisLockTTLSeconds: 30,

  mongo: {
    url:
      process.env.MONGO_CONNECTION_STRING ||
      `mongodb://${process.env.MONGO_HOST || '127.0.0.1'}/sharelatex`,
    options: {
      monitorCommands: true,
    },
  },

  publishOnIndividualChannels:
    process.env.PUBLISH_ON_INDIVIDUAL_CHANNELS === 'true',

  continuousBackgroundFlush: process.env.CONTINUOUS_BACKGROUND_FLUSH === 'true',

  smoothingOffset: process.env.SMOOTHING_OFFSET || 1000, // milliseconds
  gracefulShutdownDelayInMs:
    parseInt(process.env.GRACEFUL_SHUTDOWN_DELAY_SECONDS ?? '10', 10) * 1000,
}
