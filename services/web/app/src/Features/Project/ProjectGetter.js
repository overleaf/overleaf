const { db } = require('../../infrastructure/mongodb')
const { normalizeQuery } = require('../Helpers/Mongo')
const OError = require('@overleaf/o-error')
const metrics = require('@overleaf/metrics')
const { promisifyAll } = require('../../util/promises')
const { Project } = require('../../models/Project')
const logger = require('logger-sharelatex')
const LockManager = require('../../infrastructure/LockManager')
const { DeletedProject } = require('../../models/DeletedProject')

const ProjectGetter = {
  EXCLUDE_DEPTH: 8,

  getProjectWithoutDocLines(projectId, callback) {
    const excludes = {}
    for (let i = 1; i <= ProjectGetter.EXCLUDE_DEPTH; i++) {
      excludes[`rootFolder${Array(i).join('.folders')}.docs.lines`] = 0
    }
    ProjectGetter.getProject(projectId, excludes, callback)
  },

  getProjectWithOnlyFolders(projectId, callback) {
    const excludes = {}
    for (let i = 1; i <= ProjectGetter.EXCLUDE_DEPTH; i++) {
      excludes[`rootFolder${Array(i).join('.folders')}.docs`] = 0
      excludes[`rootFolder${Array(i).join('.folders')}.fileRefs`] = 0
    }
    ProjectGetter.getProject(projectId, excludes, callback)
  },

  getProject(projectId, projection, callback) {
    if (typeof projection === 'function' && callback == null) {
      callback = projection
      projection = {}
    }
    if (projectId == null) {
      return callback(new Error('no project id provided'))
    }
    if (typeof projection !== 'object') {
      return callback(new Error('projection is not an object'))
    }

    if (projection.rootFolder || Object.keys(projection).length === 0) {
      const ProjectEntityMongoUpdateHandler = require('./ProjectEntityMongoUpdateHandler')
      LockManager.runWithLock(
        ProjectEntityMongoUpdateHandler.LOCK_NAMESPACE,
        projectId,
        cb => ProjectGetter.getProjectWithoutLock(projectId, projection, cb),
        callback
      )
    } else {
      ProjectGetter.getProjectWithoutLock(projectId, projection, callback)
    }
  },

  getProjectWithoutLock(projectId, projection, callback) {
    if (typeof projection === 'function' && callback == null) {
      callback = projection
      projection = {}
    }
    if (projectId == null) {
      return callback(new Error('no project id provided'))
    }
    if (typeof projection !== 'object') {
      return callback(new Error('projection is not an object'))
    }

    let query
    try {
      query = normalizeQuery(projectId)
    } catch (err) {
      return callback(err)
    }

    db.projects.findOne(query, { projection }, function(err, project) {
      if (err) {
        OError.tag(err, 'error getting project', {
          query,
          projection
        })
        return callback(err)
      }
      callback(null, project)
    })
  },

  getProjectIdByReadAndWriteToken(token, callback) {
    Project.findOne({ 'tokens.readAndWrite': token }, { _id: 1 }, function(
      err,
      project
    ) {
      if (err) {
        return callback(err)
      }
      if (project == null) {
        return callback()
      }
      callback(null, project._id)
    })
  },

  findAllUsersProjects(userId, fields, callback) {
    const CollaboratorsGetter = require('../Collaborators/CollaboratorsGetter')
    Project.find({ owner_ref: userId }, fields, function(error, ownedProjects) {
      if (error) {
        return callback(error)
      }
      CollaboratorsGetter.getProjectsUserIsMemberOf(userId, fields, function(
        error,
        projects
      ) {
        if (error) {
          return callback(error)
        }
        const result = {
          owned: ownedProjects || [],
          readAndWrite: projects.readAndWrite || [],
          readOnly: projects.readOnly || [],
          tokenReadAndWrite: projects.tokenReadAndWrite || [],
          tokenReadOnly: projects.tokenReadOnly || []
        }
        callback(null, result)
      })
    })
  },

  /**
   * Return all projects with the given name that belong to the given user.
   *
   * Projects include the user's own projects as well as collaborations with
   * read/write access.
   */
  findUsersProjectsByName(userId, projectName, callback) {
    ProjectGetter.findAllUsersProjects(
      userId,
      'name archived trashed',
      (err, allProjects) => {
        if (err != null) {
          return callback(err)
        }
        const { owned, readAndWrite } = allProjects
        const projects = owned.concat(readAndWrite)
        const lowerCasedProjectName = projectName.toLowerCase()
        const matches = projects.filter(
          project => project.name.toLowerCase() === lowerCasedProjectName
        )
        callback(null, matches)
      }
    )
  },

  getUsersDeletedProjects(userId, callback) {
    DeletedProject.find(
      {
        'deleterData.deletedProjectOwnerId': userId
      },
      callback
    )
  }
}

;['getProject', 'getProjectWithoutDocLines'].map(method =>
  metrics.timeAsyncMethod(ProjectGetter, method, 'mongo.ProjectGetter', logger)
)

ProjectGetter.promises = promisifyAll(ProjectGetter)
module.exports = ProjectGetter
