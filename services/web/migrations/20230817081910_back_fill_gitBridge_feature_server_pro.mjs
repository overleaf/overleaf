import runScript from '../modules/server-ce-scripts/scripts/upgrade-user-features.js'

const tags = ['server-ce', 'server-pro']

const migrate = async () => {
  // Run-time import as SaaS does not ship with the server-ce-scripts module
  await runScript(false, {
    gitBridge: 1,
  })
}

const rollback = async () => {}

export default {
  tags,
  migrate,
  rollback,
}
