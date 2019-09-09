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
 * DS102: Remove unnecessary code created because of implicit returns
 * DS202: Simplify dynamic range loops
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const mongojs = require('../../infrastructure/mongojs')
const metrics = require('metrics-sharelatex')
const { db } = mongojs
const { ObjectId } = mongojs
const async = require('async')
const { promisifyAll } = require('../../util/promises')
const { Project } = require('../../models/Project')
const logger = require('logger-sharelatex')
const LockManager = require('../../infrastructure/LockManager')
const { DeletedProject } = require('../../models/DeletedProject')

const ProjectGetter = {
  EXCLUDE_DEPTH: 8,

  getProjectWithoutDocLines(project_id, callback) {
    if (callback == null) {
      callback = function(error, project) {}
    }
    const excludes = {}
    for (
      let i = 1, end = ProjectGetter.EXCLUDE_DEPTH, asc = end >= 1;
      asc ? i <= end : i >= end;
      asc ? i++ : i--
    ) {
      excludes[`rootFolder${Array(i).join('.folders')}.docs.lines`] = 0
    }
    return ProjectGetter.getProject(project_id, excludes, callback)
  },

  getProjectWithOnlyFolders(project_id, callback) {
    if (callback == null) {
      callback = function(error, project) {}
    }
    const excludes = {}
    for (
      let i = 1, end = ProjectGetter.EXCLUDE_DEPTH, asc = end >= 1;
      asc ? i <= end : i >= end;
      asc ? i++ : i--
    ) {
      excludes[`rootFolder${Array(i).join('.folders')}.docs`] = 0
      excludes[`rootFolder${Array(i).join('.folders')}.fileRefs`] = 0
    }
    return ProjectGetter.getProject(project_id, excludes, callback)
  },

  getProject(project_id, projection, callback) {
    if (typeof projection === 'function' && callback == null) {
      callback = projection
      projection = {}
    }
    if (project_id == null) {
      return callback(new Error('no project_id provided'))
    }
    if (typeof projection !== 'object') {
      return callback(new Error('projection is not an object'))
    }

    if (
      (projection != null ? projection.rootFolder : undefined) ||
      Object.keys(projection).length === 0
    ) {
      const ProjectEntityMongoUpdateHandler = require('./ProjectEntityMongoUpdateHandler')
      return LockManager.runWithLock(
        ProjectEntityMongoUpdateHandler.LOCK_NAMESPACE,
        project_id,
        cb => ProjectGetter.getProjectWithoutLock(project_id, projection, cb),
        callback
      )
    } else {
      return ProjectGetter.getProjectWithoutLock(
        project_id,
        projection,
        callback
      )
    }
  },

  getProjectWithoutLock(project_id, projection, callback) {
    let query
    if (typeof projection === 'function' && callback == null) {
      callback = projection
      projection = {}
    }
    if (project_id == null) {
      return callback(new Error('no project_id provided'))
    }
    if (typeof projection !== 'object') {
      return callback(new Error('projection is not an object'))
    }

    if (typeof project_id === 'string') {
      query = { _id: ObjectId(project_id) }
    } else if (project_id instanceof ObjectId) {
      query = { _id: project_id }
    } else if (
      (project_id != null ? project_id.toString().length : undefined) === 24
    ) {
      // sometimes mongoose ids are hard to identify, this will catch them
      query = { _id: ObjectId(project_id.toString()) }
    } else {
      const err = new Error('malformed get request')
      logger.log(
        { project_id, err, type: typeof project_id },
        'malformed get request'
      )
      return callback(err)
    }

    return db.projects.find(query, projection, function(err, project) {
      if (err != null) {
        logger.warn({ err, query, projection }, 'error getting project')
        return callback(err)
      }
      return callback(null, project != null ? project[0] : undefined)
    })
  },

  getProjectIdByReadAndWriteToken(token, callback) {
    if (callback == null) {
      callback = function(err, project_id) {}
    }
    return Project.findOne(
      { 'tokens.readAndWrite': token },
      { _id: 1 },
      function(err, project) {
        if (err != null) {
          return callback(err)
        }
        if (project == null) {
          return callback()
        }
        return callback(null, project._id)
      }
    )
  },

  getProjectByV1Id(v1_id, callback) {
    if (callback == null) {
      callback = function(err, v1_id) {}
    }
    return Project.findOne({ 'overleaf.id': v1_id }, { _id: 1 }, function(
      err,
      project
    ) {
      if (err != null) {
        return callback(err)
      }
      if (project == null) {
        return callback()
      }
      return callback(null, project._id)
    })
  },

  findAllUsersProjects(user_id, fields, callback) {
    if (callback == null) {
      callback = function(error, projects) {
        if (projects == null) {
          projects = {
            owned: [],
            readAndWrite: [],
            readOnly: [],
            tokenReadAndWrite: [],
            tokenReadOnly: []
          }
        }
      }
    }
    const CollaboratorsHandler = require('../Collaborators/CollaboratorsHandler')
    return Project.find({ owner_ref: user_id }, fields, function(
      error,
      ownedProjects
    ) {
      if (error != null) {
        return callback(error)
      }
      return CollaboratorsHandler.getProjectsUserIsMemberOf(
        user_id,
        fields,
        function(error, projects) {
          if (error != null) {
            return callback(error)
          }
          const result = {
            owned: ownedProjects || [],
            readAndWrite: projects.readAndWrite || [],
            readOnly: projects.readOnly || [],
            tokenReadAndWrite: projects.tokenReadAndWrite || [],
            tokenReadOnly: projects.tokenReadOnly || []
          }
          return callback(null, result)
        }
      )
    })
  },

  getUsersDeletedProjects(user_id, callback) {
    DeletedProject.find(
      {
        'deleterData.deletedProjectOwnerId': user_id
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
