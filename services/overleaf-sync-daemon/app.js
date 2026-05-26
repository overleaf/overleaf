// Entrypoint for the per-user Claude Code sync container.
//
// Required env:
//   OVERLEAF_PROJECT_ID   ObjectId of the project to sync
//   OVERLEAF_USER_ID      ObjectId of the Overleaf user to credit edits to
//   DOC_UPDATER_URL       e.g. http://document-updater:3003
//   WEB_URL               e.g. http://web:3000
//   WEB_API_USER          basic-auth user shared with web service
//   WEB_API_PASSWORD      basic-auth password shared with web service
//   WORKSPACE_DIR         e.g. /workspace
//
// Optional:
//   LOG_LEVEL             debug|info  (default info)

const { OverleafClient } = require('./lib/overleaf-client')
const { Syncer } = require('./lib/syncer')

function log(msg, fields) {
  const line = { ts: new Date().toISOString(), msg, ...(fields || {}) }
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(line))
}

async function main() {
  const projectId = required('OVERLEAF_PROJECT_ID')
  const userId = required('OVERLEAF_USER_ID')
  const docUpdaterUrl = required('DOC_UPDATER_URL')
  const webUrl = required('WEB_URL')
  const webAuth = {
    user: required('WEB_API_USER'),
    password: required('WEB_API_PASSWORD'),
  }
  const workspace = required('WORKSPACE_DIR')

  const client = new OverleafClient({
    docUpdaterUrl,
    webUrl,
    webAuth,
    projectId,
  })
  const syncer = new Syncer({ client, workspace, userId, log })

  process.on('SIGTERM', () => shutdown(syncer))
  process.on('SIGINT', () => shutdown(syncer))

  await syncer.start()
}

async function shutdown(syncer) {
  log('shutting down')
  try {
    await syncer.stop()
  } catch (err) {
    log('shutdown error', { err: err.message })
  }
  process.exit(0)
}

function required(name) {
  const v = process.env[name]
  if (!v) {
    // eslint-disable-next-line no-console
    console.error(`missing required env: ${name}`)
    process.exit(1)
  }
  return v
}

main().catch(err => {
  log('fatal', { err: err.stack || err.message })
  process.exit(1)
})
