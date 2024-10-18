import runScript from '../scripts/back_fill_deleted_files.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

const migrate = async client => {
  const options = {
    performCleanup: true,
    letUserDoubleCheckInputsFor: 10,
    fixPartialInserts: true,
  }
  await runScript(options)
}

const rollback = async client => {}

export default {
  tags,
  migrate,
  rollback,
}
