const { DeletedProject } = require('../app/src/models/DeletedProject')
const Async = require('async')

DeletedProject.find({}, (error, deletedProjects) => {
  if (error) {
    throw error
  }

  Async.eachLimit(
    deletedProjects,
    10,
    (deletedProject, cb) => {
      if (deletedProject.project) {
        const src = deletedProject.project

        let values = {
          'deleterData.deletedProjectId': src._id,
          'deleterData.deletedProjectOwnerId': src.owner_ref,
          'deleterData.deletedProjectCollaboratorIds': src.collaberator_refs,
          'deleterData.deletedProjectReadOnlyIds': src.readOnly_refs,
          'deleterData.deletedProjectReadWriteToken': src.tokens
            ? src.tokens.readAndWrite
            : undefined,
          'deleterData.deletedProjectOverleafId': src.overleaf
            ? src.overleaf.id
            : undefined,
          'deleterData.deletedProjectOverleafHistoryId':
            src.overleaf && src.overleaf.history
              ? src.overleaf.history.id
              : undefined,
          'deleterData.deletedProjectReadOnlyToken': src.tokens
            ? src.tokens.readOnly
            : undefined,
          'deleterData.deletedProjectReadWriteTokenAccessIds':
            src.tokenAccessReadOnly_refs,
          'deleterData.deletedProjectReadOnlyTokenAccessIds':
            src.tokenAccessReadAndWrite_refs,
          'deleterData.deletedProjectLastUpdatedAt': src.lastUpdated
        }

        Object.keys(values).forEach(
          key => (values[key] === undefined ? delete values[key] : '')
        )

        DeletedProject.findOneAndUpdate(
          { _id: deletedProject._id },
          {
            $set: values
          },
          cb
        )
      } else {
        cb()
      }
    },
    err => {
      if (err) {
        throw err
      }
      process.exit(0)
    }
  )
})
