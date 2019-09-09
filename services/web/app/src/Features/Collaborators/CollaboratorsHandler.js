/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const UserCreator = require('../User/UserCreator')
const { Project } = require('../../models/Project')
const ProjectGetter = require('../Project/ProjectGetter')
const logger = require('logger-sharelatex')
const UserGetter = require('../User/UserGetter')
const ContactManager = require('../Contacts/ContactManager')
const CollaboratorsEmailHandler = require('./CollaboratorsEmailHandler')
const async = require('async')
const PrivilegeLevels = require('../Authorization/PrivilegeLevels')
const PublicAccessLevels = require('../Authorization/PublicAccessLevels')
const Errors = require('../Errors/Errors')
const EmailHelper = require('../Helpers/EmailHelper')
const ProjectEditorHandler = require('../Project/ProjectEditorHandler')
const Sources = require('../Authorization/Sources')
const { ObjectId } = require('mongojs')
const { promisifyAll } = require('../../util/promises')

const CollaboratorsHandler = {
  getMemberIdsWithPrivilegeLevels(project_id, callback) {
    if (callback == null) {
      callback = function(error, members) {}
    }
    const projection = {
      owner_ref: 1,
      collaberator_refs: 1,
      readOnly_refs: 1,
      tokenAccessReadOnly_refs: 1,
      tokenAccessReadAndWrite_refs: 1,
      publicAccesLevel: 1
    }
    ProjectGetter.getProject(project_id, projection, (error, project) => {
      if (error) {
        return callback(error)
      }
      if (!project) {
        return callback(
          new Errors.NotFoundError(`no project found with id ${project_id}`)
        )
      }
      callback(
        null,
        CollaboratorsHandler.getMemberIdsWithPrivilegeLevelsFromFields(
          project.owner_ref,
          project.collaberator_refs,
          project.readOnly_refs,
          project.tokenAccessReadAndWrite_refs,
          project.tokenAccessReadOnly_refs,
          project.publicAccesLevel
        )
      )
    })
  },

  getMemberIdsWithPrivilegeLevelsFromFields(
    ownerId,
    collaboratorIds,
    readOnlyIds,
    tokenAccessIds,
    tokenAccessReadOnlyIds,
    publicAccessLevel
  ) {
    let member_id
    const members = []
    members.push({
      id: ownerId.toString(),
      privilegeLevel: PrivilegeLevels.OWNER,
      source: Sources.OWNER
    })
    for (member_id of Array.from(collaboratorIds || [])) {
      members.push({
        id: member_id.toString(),
        privilegeLevel: PrivilegeLevels.READ_AND_WRITE,
        source: Sources.INVITE
      })
    }
    for (member_id of Array.from(readOnlyIds || [])) {
      members.push({
        id: member_id.toString(),
        privilegeLevel: PrivilegeLevels.READ_ONLY,
        source: Sources.INVITE
      })
    }
    if (publicAccessLevel === PublicAccessLevels.TOKEN_BASED) {
      for (member_id of Array.from(tokenAccessIds || [])) {
        members.push({
          id: member_id.toString(),
          privilegeLevel: PrivilegeLevels.READ_AND_WRITE,
          source: Sources.TOKEN
        })
      }
      for (member_id of Array.from(tokenAccessReadOnlyIds || [])) {
        members.push({
          id: member_id.toString(),
          privilegeLevel: PrivilegeLevels.READ_ONLY,
          source: Sources.TOKEN
        })
      }
    }
    return members
  },

  getMemberIds(project_id, callback) {
    if (callback == null) {
      callback = function(error, member_ids) {}
    }
    return CollaboratorsHandler.getMemberIdsWithPrivilegeLevels(
      project_id,
      function(error, members) {
        if (error != null) {
          return callback(error)
        }
        return callback(null, members.map(m => m.id))
      }
    )
  },

  getInvitedMemberIds(project_id, callback) {
    if (callback == null) {
      callback = function(error, member_ids) {}
    }
    return CollaboratorsHandler.getMemberIdsWithPrivilegeLevels(
      project_id,
      function(error, members) {
        if (error != null) {
          return callback(error)
        }
        return callback(
          null,
          members.filter(m => m.source !== Sources.TOKEN).map(m => m.id)
        )
      }
    )
  },

  USER_PROJECTION: {
    _id: 1,
    email: 1,
    features: 1,
    first_name: 1,
    last_name: 1,
    signUpDate: 1
  },
  _loadMembers(members, callback) {
    if (callback == null) {
      callback = function(error, users) {}
    }
    const result = []
    return async.mapLimit(
      members,
      3,
      (member, cb) =>
        UserGetter.getUserOrUserStubById(
          member.id,
          CollaboratorsHandler.USER_PROJECTION,
          function(error, user) {
            if (error != null) {
              return cb(error)
            }
            if (user != null) {
              result.push({ user, privilegeLevel: member.privilegeLevel })
            }
            return cb()
          }
        ),
      function(error) {
        if (error != null) {
          return callback(error)
        }
        return callback(null, result)
      }
    )
  },

  getMembersWithPrivilegeLevels(project_id, callback) {
    if (callback == null) {
      callback = function(error, members) {}
    }
    return CollaboratorsHandler.getMemberIdsWithPrivilegeLevels(
      project_id,
      function(error, members) {
        if (members == null) {
          members = []
        }
        if (error != null) {
          return callback(error)
        }
        return CollaboratorsHandler._loadMembers(members, (error, users) =>
          callback(error, users)
        )
      }
    )
  },

  getInvitedMembersWithPrivilegeLevels(project_id, callback) {
    if (callback == null) {
      callback = function(error, members) {}
    }
    return CollaboratorsHandler.getMemberIdsWithPrivilegeLevels(
      project_id,
      function(error, members) {
        if (members == null) {
          members = []
        }
        if (error != null) {
          return callback(error)
        }
        members = members.filter(m => m.source !== Sources.TOKEN)
        return CollaboratorsHandler._loadMembers(members, (error, users) =>
          callback(error, users)
        )
      }
    )
  },

  getInvitedMembersWithPrivilegeLevelsFromFields(
    ownerId,
    collaboratorIds,
    readOnlyIds,
    callback
  ) {
    let members = CollaboratorsHandler.getMemberIdsWithPrivilegeLevelsFromFields(
      ownerId,
      collaboratorIds,
      readOnlyIds,
      [],
      [],
      null
    )
    return CollaboratorsHandler._loadMembers(members, (error, users) =>
      callback(error, users)
    )
  },

  getTokenMembersWithPrivilegeLevels(project_id, callback) {
    if (callback == null) {
      callback = function(error, members) {}
    }
    return CollaboratorsHandler.getMemberIdsWithPrivilegeLevels(
      project_id,
      function(error, members) {
        if (members == null) {
          members = []
        }
        if (error != null) {
          return callback(error)
        }
        members = members.filter(m => m.source === Sources.TOKEN)
        return CollaboratorsHandler._loadMembers(members, (error, users) =>
          callback(error, users)
        )
      }
    )
  },

  getMemberIdPrivilegeLevel(user_id, project_id, callback) {
    // In future if the schema changes and getting all member ids is more expensive (multiple documents)
    // then optimise this.
    if (callback == null) {
      callback = function(error, privilegeLevel) {}
    }
    return CollaboratorsHandler.getMemberIdsWithPrivilegeLevels(
      project_id,
      function(error, members) {
        if (members == null) {
          members = []
        }
        if (error != null) {
          return callback(error)
        }
        for (let member of Array.from(members)) {
          if (
            member.id === (user_id != null ? user_id.toString() : undefined)
          ) {
            return callback(null, member.privilegeLevel)
          }
        }
        return callback(null, PrivilegeLevels.NONE)
      }
    )
  },

  getInvitedMemberCount(project_id, callback) {
    if (callback == null) {
      callback = function(error, count) {}
    }
    return CollaboratorsHandler.getMemberIdsWithPrivilegeLevels(
      project_id,
      function(error, members) {
        if (error != null) {
          return callback(error)
        }
        return callback(
          null,
          (members || []).filter(m => m.source !== Sources.TOKEN).length
        )
      }
    )
  },

  getInvitedCollaboratorCount(project_id, callback) {
    if (callback == null) {
      callback = function(error, count) {}
    }
    return CollaboratorsHandler.getInvitedMemberCount(project_id, function(
      error,
      count
    ) {
      if (error != null) {
        return callback(error)
      }
      return callback(null, count - 1)
    })
  }, // Don't count project owner

  isUserInvitedMemberOfProject(user_id, project_id, callback) {
    if (callback == null) {
      callback = function(error, isMember, privilegeLevel) {}
    }
    return CollaboratorsHandler.getMemberIdsWithPrivilegeLevels(
      project_id,
      function(error, members) {
        if (members == null) {
          members = []
        }
        if (error != null) {
          return callback(error)
        }
        for (let member of Array.from(members)) {
          if (
            member.id.toString() === user_id.toString() &&
            member.source !== Sources.TOKEN
          ) {
            return callback(null, true, member.privilegeLevel)
          }
        }
        return callback(null, false, null)
      }
    )
  },

  getProjectsUserIsMemberOf(user_id, fields, callback) {
    if (callback == null) {
      callback = function(error, results) {}
    }
    return async.mapLimit(
      [
        { collaberator_refs: user_id },
        { readOnly_refs: user_id },
        {
          tokenAccessReadAndWrite_refs: user_id,
          publicAccesLevel: PublicAccessLevels.TOKEN_BASED
        },
        {
          tokenAccessReadOnly_refs: user_id,
          publicAccesLevel: PublicAccessLevels.TOKEN_BASED
        }
      ],
      2,
      (query, cb) => Project.find(query, fields, cb),
      function(error, results) {
        if (error != null) {
          return callback(error)
        }
        const projects = {
          readAndWrite: results[0],
          readOnly: results[1],
          tokenReadAndWrite: results[2],
          tokenReadOnly: results[3]
        }
        return callback(null, projects)
      }
    )
  },

  removeUserFromProject(project_id, user_id, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    logger.log({ user_id, project_id }, 'removing user')
    const conditions = { _id: project_id }
    const update = { $pull: {} }
    update['$pull'] = {
      collaberator_refs: user_id,
      readOnly_refs: user_id,
      tokenAccessReadOnly_refs: user_id,
      tokenAccessReadAndWrite_refs: user_id
    }
    return Project.update(conditions, update, function(err) {
      if (err != null) {
        logger.warn({ err }, 'problem removing user from project collaberators')
      }
      return callback(err)
    })
  },

  removeUserFromAllProjets(user_id, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return CollaboratorsHandler.getProjectsUserIsMemberOf(
      user_id,
      { _id: 1 },
      function(
        error,
        { readAndWrite, readOnly, tokenReadAndWrite, tokenReadOnly }
      ) {
        if (error != null) {
          return callback(error)
        }
        const allProjects = readAndWrite
          .concat(readOnly)
          .concat(tokenReadAndWrite)
          .concat(tokenReadOnly)
        const jobs = []
        for (let project of Array.from(allProjects)) {
          ;(project =>
            jobs.push(function(cb) {
              if (project == null) {
                return cb()
              }
              return CollaboratorsHandler.removeUserFromProject(
                project._id,
                user_id,
                cb
              )
            }))(project)
        }
        return async.series(jobs, callback)
      }
    )
  },

  addUserIdToProject(
    project_id,
    adding_user_id,
    user_id,
    privilegeLevel,
    callback
  ) {
    if (callback == null) {
      callback = function(error) {}
    }
    return ProjectGetter.getProject(
      project_id,
      { collaberator_refs: 1, readOnly_refs: 1 },
      function(error, project) {
        let level
        if (error != null) {
          return callback(error)
        }
        let existing_users = project.collaberator_refs || []
        existing_users = existing_users.concat(project.readOnly_refs || [])
        existing_users = existing_users.map(u => u.toString())
        if (existing_users.indexOf(user_id.toString()) > -1) {
          return callback(null) // User already in Project
        }

        if (privilegeLevel === PrivilegeLevels.READ_AND_WRITE) {
          level = { collaberator_refs: user_id }
          logger.log(
            { privileges: 'readAndWrite', user_id, project_id },
            'adding user'
          )
        } else if (privilegeLevel === PrivilegeLevels.READ_ONLY) {
          level = { readOnly_refs: user_id }
          logger.log(
            { privileges: 'readOnly', user_id, project_id },
            'adding user'
          )
        } else {
          return callback(
            new Error(`unknown privilegeLevel: ${privilegeLevel}`)
          )
        }

        if (adding_user_id) {
          ContactManager.addContact(adding_user_id, user_id)
        }

        return Project.update(
          { _id: project_id },
          { $addToSet: level },
          function(error) {
            if (error != null) {
              return callback(error)
            }
            // Flush to TPDS in background to add files to collaborator's Dropbox
            const ProjectEntityHandler = require('../Project/ProjectEntityHandler')
            ProjectEntityHandler.flushProjectToThirdPartyDataStore(
              project_id,
              function(error) {
                if (error != null) {
                  return logger.error(
                    { err: error, project_id, user_id },
                    'error flushing to TPDS after adding collaborator'
                  )
                }
              }
            )
            return callback()
          }
        )
      }
    )
  },

  getAllInvitedMembers(projectId, callback) {
    if (callback == null) {
      callback = function(err, members) {}
    }
    logger.log({ projectId }, 'fetching all members')
    return CollaboratorsHandler.getInvitedMembersWithPrivilegeLevels(
      projectId,
      function(error, rawMembers) {
        if (error != null) {
          logger.warn({ projectId, error }, 'error getting members for project')
          return callback(error)
        }
        const {
          owner,
          members
        } = ProjectEditorHandler.buildOwnerAndMembersViews(rawMembers)
        return callback(null, members)
      }
    )
  },

  userIsTokenMember(userId, projectId, callback) {
    if (callback == null) {
      callback = function(err, isTokenMember) {}
    }
    userId = ObjectId(userId.toString())
    projectId = ObjectId(projectId.toString())
    return Project.findOne(
      {
        _id: projectId,
        $or: [
          { tokenAccessReadOnly_refs: userId },
          { tokenAccessReadAndWrite_refs: userId }
        ]
      },
      {
        _id: 1
      },
      function(err, project) {
        if (err != null) {
          return callback(err)
        }
        return callback(null, project != null)
      }
    )
  },

  transferProjects(from_user_id, to_user_id, callback) {
    if (callback == null) {
      callback = function(err, projects) {}
    }
    const MEMBER_KEYS = ['collaberator_refs', 'readOnly_refs']

    // Find all the projects this user is part of so we can flush them to TPDS
    let query = {
      $or: [{ owner_ref: from_user_id }].concat(
        MEMBER_KEYS.map(function(key) {
          const q = {}
          q[key] = from_user_id
          return q
        })
      ) // [{ collaberator_refs: from_user_id }, ...]
    }
    return Project.find(query, { _id: 1 }, function(error, projects) {
      if (projects == null) {
        projects = []
      }
      if (error != null) {
        return callback(error)
      }

      const project_ids = projects.map(p => p._id)
      logger.log(
        { project_ids, from_user_id, to_user_id },
        'transferring projects'
      )

      const update_jobs = []
      update_jobs.push(cb =>
        Project.update(
          { owner_ref: from_user_id },
          { $set: { owner_ref: to_user_id } },
          { multi: true },
          cb
        )
      )
      for (let key of Array.from(MEMBER_KEYS)) {
        ;(key =>
          update_jobs.push(function(cb) {
            query = {}
            const addNewUserUpdate = { $addToSet: {} }
            const removeOldUserUpdate = { $pull: {} }
            query[key] = from_user_id
            removeOldUserUpdate.$pull[key] = from_user_id
            addNewUserUpdate.$addToSet[key] = to_user_id
            // Mongo won't let us pull and addToSet in the same query, so do it in
            // two. Note we need to add first, since the query is based on the old user.
            return Project.update(
              query,
              addNewUserUpdate,
              { multi: true },
              function(error) {
                if (error != null) {
                  return cb(error)
                }
                return Project.update(
                  query,
                  removeOldUserUpdate,
                  { multi: true },
                  cb
                )
              }
            )
          }))(key)
      }

      // Flush each project to TPDS to add files to new user's Dropbox
      const ProjectEntityHandler = require('../Project/ProjectEntityHandler')
      const flush_jobs = []
      for (let project_id of Array.from(project_ids)) {
        ;(project_id =>
          flush_jobs.push(cb =>
            ProjectEntityHandler.flushProjectToThirdPartyDataStore(
              project_id,
              cb
            )
          ))(project_id)
      }

      // Flush in background, no need to block on this
      async.series(flush_jobs, function(error) {
        if (error != null) {
          return logger.err(
            { err: error, project_ids, from_user_id, to_user_id },
            'error flushing tranferred projects to TPDS'
          )
        }
      })

      return async.series(update_jobs, function(err) {
        logger.log('flushed transferred projects to TPDS')
        return callback(err)
      })
    })
  }
}

CollaboratorsHandler.promises = promisifyAll(CollaboratorsHandler, {
  without: ['getMemberIdsWithPrivilegeLevelsFromFields']
})
module.exports = CollaboratorsHandler
