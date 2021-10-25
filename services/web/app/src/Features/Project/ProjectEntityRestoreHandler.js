const { callbackify } = require('util')
const Path = require('path')
const ProjectEntityHandler = require('./ProjectEntityHandler')
const ProjectEntityUpdateHandler = require('./ProjectEntityUpdateHandler')

async function restoreDeletedDoc(projectId, docId, docName, userId) {
  const deletedDoc = await ProjectEntityHandler.promises.getDoc(
    projectId,
    docId,
    { include_deleted: true }
  )

  const formattedTimestamp = new Date()
    .toISOString()
    .replace('T', '-')
    .replace(/[^0-9-]/g, '')
  const extension = Path.extname(docName)
  const basename = Path.basename(docName, extension)
  const deletedDocName = `${basename}-${formattedTimestamp}${extension}`
  return await ProjectEntityUpdateHandler.promises.addDocWithRanges(
    projectId,
    null,
    `${deletedDocName}`,
    deletedDoc.lines,
    deletedDoc.ranges,
    userId
  )
}

module.exports = {
  restoreDeletedDoc: callbackify(restoreDeletedDoc),
  promises: {
    restoreDeletedDoc,
  },
}
