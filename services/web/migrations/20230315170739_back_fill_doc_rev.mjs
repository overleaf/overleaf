import runScript from '../scripts/back_fill_doc_rev.js'

const tags = ['server-ce', 'server-pro']

const migrate = async () => {
  await runScript(false)
}

const rollback = async () => {}

export default {
  tags,
  migrate,
  rollback,
}
