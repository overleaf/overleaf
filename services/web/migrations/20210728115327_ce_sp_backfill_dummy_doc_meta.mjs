import runScript from '../scripts/back_fill_dummy_doc_meta.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

const migrate = async client => {
  const { db } = client
  const [firstProject] = await db.projects
    .find()
    .sort({ _id: 1 })
    .limit(1)
    .toArray()
  if (!firstProject) {
    return
  }
  const options = {
    firstProjectId: firstProject._id,
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
