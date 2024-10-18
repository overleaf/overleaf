import runScript from '../scripts/back_fill_doc_name_for_deleted_docs.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

const migrate = async client => {
  const options = {
    performCleanup: true,
    letUserDoubleCheckInputsFor: 10,
  }
  await runScript(options)
}

const rollback = async client => {}

export default {
  tags,
  migrate,
  rollback,
}
