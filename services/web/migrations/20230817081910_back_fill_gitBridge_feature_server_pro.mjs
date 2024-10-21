const tags = ['server-ce', 'server-pro']

const migrate = async () => {
  // Run-time import as SaaS does not ship with the server-ce-scripts module
  const { default: runScript } = await import(
    '../modules/server-ce-scripts/scripts/upgrade-user-features.mjs'
  )
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
