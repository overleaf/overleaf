/* eslint-disable camelcase */
const http = require('node:http')
const https = require('node:https')

http.globalAgent.keepAlive = false
https.globalAgent.keepAlive = false

const settings = {
  redis: {
    pubsub: {
      host:
        process.env.PUBSUB_REDIS_HOST || process.env.REDIS_HOST || '127.0.0.1',
      port: process.env.PUBSUB_REDIS_PORT || process.env.REDIS_PORT || '6379',
      password:
        process.env.PUBSUB_REDIS_PASSWORD || process.env.REDIS_PASSWORD || '',
      maxRetriesPerRequest: parseInt(
        process.env.PUBSUB_REDIS_MAX_RETRIES_PER_REQUEST ||
          process.env.REDIS_MAX_RETRIES_PER_REQUEST ||
          '20'
      ),
    },

    realtime: {
      host:
        process.env.REAL_TIME_REDIS_HOST ||
        process.env.REDIS_HOST ||
        '127.0.0.1',
      port:
        process.env.REAL_TIME_REDIS_PORT || process.env.REDIS_PORT || '6379',
      password:
        process.env.REAL_TIME_REDIS_PASSWORD ||
        process.env.REDIS_PASSWORD ||
        '',
      key_schema: {
        clientsInProject({ project_id }) {
          return `clients_in_project:{${project_id}}`
        },
        connectedUser({ project_id, client_id }) {
          return `connected_user:{${project_id}}:${client_id}`
        },
      },
      maxRetriesPerRequest: parseInt(
        process.env.REAL_TIME_REDIS_MAX_RETRIES_PER_REQUEST ||
          process.env.REDIS_MAX_RETRIES_PER_REQUEST ||
          '20'
      ),
    },

    documentupdater: {
      host:
        process.env.DOC_UPDATER_REDIS_HOST ||
        process.env.REDIS_HOST ||
        '127.0.0.1',
      port:
        process.env.DOC_UPDATER_REDIS_PORT || process.env.REDIS_PORT || '6379',
      password:
        process.env.DOC_UPDATER_REDIS_PASSWORD ||
        process.env.REDIS_PASSWORD ||
        '',
      key_schema: {
        pendingUpdates({ doc_id }) {
          return `PendingUpdates:{${doc_id}}`
        },
      },
      maxRetriesPerRequest: parseInt(
        process.env.DOC_UPDATER_REDIS_MAX_RETRIES_PER_REQUEST ||
          process.env.REDIS_MAX_RETRIES_PER_REQUEST ||
          '20'
      ),
    },

    websessions: {
      host:
        process.env.SESSIONS_REDIS_HOST ||
        process.env.REDIS_HOST ||
        '127.0.0.1',
      port: process.env.SESSIONS_REDIS_PORT || process.env.REDIS_PORT || '6379',
      password:
        process.env.SESSIONS_REDIS_PASSWORD || process.env.REDIS_PASSWORD || '',
      maxRetriesPerRequest: parseInt(
        process.env.SESSIONS_REDIS_MAX_RETRIES_PER_REQUEST ||
          process.env.REDIS_MAX_RETRIES_PER_REQUEST ||
          '20'
      ),
    },
  },

  internal: {
    realTime: {
      port: 3026,
      host: process.env.LISTEN_ADDRESS || '127.0.0.1',
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
    documentupdater: {
      url: `http://${
        process.env.DOCUMENT_UPDATER_HOST ||
        process.env.DOCUPDATER_HOST ||
        '127.0.0.1'
      }:3003`,
    },
  },

  security: {
    sessionSecret: process.env.SESSION_SECRET,
    sessionSecretUpcoming: process.env.SESSION_SECRET_UPCOMING,
    sessionSecretFallback: process.env.SESSION_SECRET_FALLBACK,
  },

  cookieName: process.env.COOKIE_NAME || 'overleaf.sid',

  // Expose the hostname in the `debug.getHostname` rpc
  exposeHostname: process.env.EXPOSE_HOSTNAME === 'true',

  max_doc_length: 2 * 1024 * 1024, // 2mb

  // should be set to the same same as dispatcherCount in document updater
  pendingUpdateListShardCount: parseInt(
    process.env.PENDING_UPDATE_LIST_SHARD_COUNT || 10,
    10
  ),

  // combine
  // max_doc_length (2mb see above) * 2 (delete + insert)
  // max_ranges_size (3mb see MAX_RANGES_SIZE in document-updater)
  // overhead for JSON serialization
  maxUpdateSize:
    parseInt(process.env.MAX_UPDATE_SIZE) || 7 * 1024 * 1024 + 64 * 1024,

  shutdownDrainTimeWindow: process.env.SHUTDOWN_DRAIN_TIME_WINDOW || 9,

  // The shutdown procedure asks clients to reconnect gracefully.
  // 3rd-party/buggy clients may not act upon receiving the message and keep
  //  stale connections alive. We forcefully disconnect them after X ms:
  gracefulReconnectTimeoutMs:
    parseInt(process.env.GRACEFUL_RECONNECT_TIMEOUT_MS, 10) ||
    // The frontend allows actively editing users to keep the connection open
    //  for up-to ConnectionManager.MAX_RECONNECT_GRACEFULLY_INTERVAL=45s
    // Permit an extra delay to account for slow/flaky connections.
    (45 + 30) * 1000,

  continualPubsubTraffic: process.env.CONTINUAL_PUBSUB_TRAFFIC || false,

  checkEventOrder: process.env.CHECK_EVENT_ORDER || false,

  publishOnIndividualChannels:
    process.env.PUBLISH_ON_INDIVIDUAL_CHANNELS || false,

  statusCheckInterval: parseInt(process.env.STATUS_CHECK_INTERVAL || '0'),

  // The deployment colour for this app (if any). Used for blue green deploys.
  deploymentColour: process.env.DEPLOYMENT_COLOUR,
  // Load balancer health checks will return 200 only when this file contains
  // the deployment colour for this app.
  deploymentFile: process.env.DEPLOYMENT_FILE,

  errors: {
    catchUncaughtErrors: true,
    shutdownOnUncaughtError: true,
  },

  behindProxy: process.env.BEHIND_PROXY === 'true',
  trustedProxyIps: process.env.TRUSTED_PROXY_IPS,
  keepAliveTimeoutMs: parseInt(process.env.KEEPALIVE_TIMEOUT_MS ?? '5000', 10),
}

// console.log settings.redis
module.exports = settings
