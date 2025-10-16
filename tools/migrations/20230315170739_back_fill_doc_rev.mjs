import runScript from './scripts/back_fill_doc_rev.mjs'

const tags = ['server-ce', 'server-pro']

const migrate = async () => {
  await runScript()
}

const rollback = async () => {}

export default {
  tags,
  migrate,
  rollback,
}
