const { DeletedProject } = require('../app/src/models/DeletedProject')
const { DeletedUser } = require('../app/src/models/DeletedUser')
const { db } = require('../app/src/infrastructure/mongojs')
const pLimit = require('p-limit')

const CONCURRENCY = 10

function getCollectionContents(collection) {
  return new Promise((resolve, reject) => {
    collection.find({}).toArray((error, contents) => {
      if (error) {
        reject(error)
      } else {
        resolve(contents)
      }
    })
  })
}

function deleteCollectionItem(collection, id) {
  return new Promise((resolve, reject) => {
    collection.remove({ _id: id }, error => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

async function backfillUser(user) {
  await DeletedUser.create({
    user: user,
    deleterData: {
      deletedAt: new Date(),
      deletedUserId: user._id,
      deletedUserLastLoggedIn: user.lastLoggedIn,
      deletedUserSignUpDate: user.signUpDate,
      deletedUserLoginCount: user.loginCount,
      deletedUserReferralId: user.referal_id,
      deletedUserReferredUsers: user.refered_users,
      deletedUserReferredUserCount: user.refered_user_count,
      deletedUserOverleafId: user.overleaf ? user.overleaf.id : undefined
    }
  })
  await deleteCollectionItem(db.usersDeletedByMigration, user._id)
}

async function backfillProject(project) {
  await DeletedProject.create({
    project: project,
    deleterData: {
      deletedAt: new Date(),
      deletedProjectId: project._id,
      deletedProjectOwnerId: project.owner_ref,
      deletedProjectCollaboratorIds: project.collaberator_refs,
      deletedProjectReadOnlyIds: project.readOnly_refs,
      deletedProjectReadWriteTokenAccessIds:
        project.tokenAccessReadAndWrite_refs,
      deletedProjectReadOnlyTokenAccessIds: project.tokenAccessReadOnly_refs,
      deletedProjectReadWriteToken: project.tokens
        ? project.tokens.readAndWrite
        : undefined,
      deletedProjectReadOnlyToken: project.tokens
        ? project.tokens.readOnly
        : undefined,
      deletedProjectLastUpdatedAt: project.lastUpdated
    }
  })
  await deleteCollectionItem(db.projectsDeletedByMigration, project._id)
}

async function backfillUsers() {
  const limit = pLimit(CONCURRENCY)

  const migrationUsers = await getCollectionContents(db.usersDeletedByMigration)
  console.log('Found ' + migrationUsers.length + ' users')
  await Promise.all(migrationUsers.map(user => limit(() => backfillUser(user))))
}

async function backfillProjects() {
  const limit = pLimit(CONCURRENCY)

  const migrationProjects = await getCollectionContents(
    db.projectsDeletedByMigration
  )
  console.log('Found ' + migrationProjects.length + ' projects')
  await Promise.all(
    migrationProjects.map(project => limit(() => backfillProject(project)))
  )
}

Promise.all([backfillProjects(), backfillUsers()]).then(() => {
  console.log('Finished')
  process.exit(0)
})
