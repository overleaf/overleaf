const runScript = require('../scripts/back_fill_dummy_doc_meta.js')

exports.tags = ['server-ce', 'server-pro', 'saas']

exports.migrate = async client => {
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

exports.rollback = async client => {}
