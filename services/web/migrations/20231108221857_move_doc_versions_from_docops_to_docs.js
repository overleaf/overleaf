const { ReadPreference } = require('mongodb')

exports.tags = ['server-ce', 'server-pro', 'saas']

exports.migrate = async ({ db }) => {
  const records = db.docOps.find(
    {},
    { readPreference: ReadPreference.secondaryPreferred }
  )

  let docsProcessed = 0
  for await (const record of records) {
    const docId = record.doc_id
    const version = record.version
    await db.docs.updateOne(
      {
        _id: docId,
        version: { $exists: false },
      },
      { $set: { version } }
    )
    docsProcessed += 1
    if (docsProcessed % 100000 === 0) {
      console.log(`${docsProcessed} docs processed`)
    }
  }
}

exports.rollback = async ({ db }) => {
  // Nothing to do on rollback. We don't want to remove versions from the docs
  // collection because they might be more current than the ones in the docOps
  // collection.
}
