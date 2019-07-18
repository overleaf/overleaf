const { DeletedProject } = require('../app/src/models/DeletedProject')
const Async = require('async')

DeletedProject.find(
  {},
  { 'project._id': 1, 'project.owner_ref': 1 },
  (error, deletedProjects) => {
    if (error) {
      throw error
    }

    Async.eachLimit(
      deletedProjects,
      10,
      (deletedProject, cb) => {
        if (deletedProject.project) {
          const src = deletedProject.project
          DeletedProject.findOneAndUpdate(
            { _id: deletedProject._id },
            {
              $set: {
                'deleterData.deletedProjectId': src._id,
                'deleterData.deletedProjectOwnerId': src.owner_ref,
                'deleterData.deletedProjectCollaboratorIds':
                  src.collaberator_refs,
                'deleterData.deletedProjectReadOnlyIds': src.readOnly_refs,
                'deleterData.deletedProjectReadWriteToken': src.tokens
                  ? src.tokens.readAndWrite
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
  }
)
