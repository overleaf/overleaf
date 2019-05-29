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
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ProjectDetailsHandler
const ProjectGetter = require('./ProjectGetter')
const UserGetter = require('../User/UserGetter')
const { Project } = require('../../models/Project')
const { ObjectId } = require('mongojs')
const logger = require('logger-sharelatex')
const tpdsUpdateSender = require('../ThirdPartyDataStore/TpdsUpdateSender')
const _ = require('underscore')
const PublicAccessLevels = require('../Authorization/PublicAccessLevels')
const Errors = require('../Errors/Errors')
const ProjectTokenGenerator = require('./ProjectTokenGenerator')
const ProjectEntityHandler = require('./ProjectEntityHandler')
const ProjectHelper = require('./ProjectHelper')
const CollaboratorsHandler = require('../Collaborators/CollaboratorsHandler')
const settings = require('settings-sharelatex')

module.exports = ProjectDetailsHandler = {
  getDetails(project_id, callback) {
    return ProjectGetter.getProject(
      project_id,
      {
        name: true,
        description: true,
        compiler: true,
        features: true,
        owner_ref: true,
        overleaf: true
      },
      function(err, project) {
        if (err != null) {
          logger.err({ err, project_id }, 'error getting project')
          return callback(err)
        }
        if (project == null) {
          return callback(new Errors.NotFoundError('project not found'))
        }
        return UserGetter.getUser(project.owner_ref, function(err, user) {
          if (err != null) {
            return callback(err)
          }
          const details = {
            name: project.name,
            description: project.description,
            compiler: project.compiler,
            features:
              (user != null ? user.features : undefined) ||
              settings.defaultFeatures
          }

          if (project.overleaf != null) {
            details.overleaf = project.overleaf
          }

          logger.log({ project_id, details }, 'getting project details')
          return callback(err, details)
        })
      }
    )
  },

  getProjectDescription(project_id, callback) {
    return ProjectGetter.getProject(
      project_id,
      { description: true },
      (err, project) =>
        callback(err, project != null ? project.description : undefined)
    )
  },

  setProjectDescription(project_id, description, callback) {
    const conditions = { _id: project_id }
    const update = { description }
    logger.log(
      { conditions, update, project_id, description },
      'setting project description'
    )
    return Project.update(conditions, update, function(err) {
      if (err != null) {
        logger.err({ err }, 'something went wrong setting project description')
      }
      return callback(err)
    })
  },

  transferOwnership(project_id, user_id, suffix, callback) {
    if (suffix == null) {
      suffix = ''
    }
    if (typeof suffix === 'function') {
      callback = suffix
      suffix = ''
    }
    return ProjectGetter.getProject(
      project_id,
      { owner_ref: true, name: true },
      function(err, project) {
        if (err != null) {
          return callback(err)
        }
        if (project == null) {
          return callback(new Errors.NotFoundError('project not found'))
        }
        if (project.owner_ref === user_id) {
          return callback()
        }

        return UserGetter.getUser(user_id, function(err, user) {
          if (err != null) {
            return callback(err)
          }
          if (user == null) {
            return callback(new Errors.NotFoundError('user not found'))
          }

          //	we make sure the user to which the project is transferred is not a collaborator for the project,
          //	this prevents any conflict during unique name generation
          return CollaboratorsHandler.removeUserFromProject(
            project_id,
            user_id,
            function(err) {
              if (err != null) {
                return callback(err)
              }
              return ProjectDetailsHandler.generateUniqueName(
                user_id,
                project.name + suffix,
                function(err, name) {
                  if (err != null) {
                    return callback(err)
                  }
                  return Project.update(
                    { _id: project_id },
                    {
                      $set: {
                        owner_ref: user_id,
                        name
                      }
                    },
                    function(err) {
                      if (err != null) {
                        return callback(err)
                      }
                      return ProjectEntityHandler.flushProjectToThirdPartyDataStore(
                        project_id,
                        callback
                      )
                    }
                  )
                }
              )
            }
          )
        })
      }
    )
  },

  renameProject(project_id, newName, callback) {
    if (callback == null) {
      callback = function() {}
    }
    return ProjectDetailsHandler.validateProjectName(newName, function(error) {
      if (error != null) {
        return callback(error)
      }
      logger.log({ project_id, newName }, 'renaming project')
      return ProjectGetter.getProject(project_id, { name: true }, function(
        err,
        project
      ) {
        if (err != null || project == null) {
          logger.err(
            { err, project_id },
            'error getting project or could not find it todo project rename'
          )
          return callback(err)
        }
        const oldProjectName = project.name
        return Project.update(
          { _id: project_id },
          { name: newName },
          (err, project) => {
            if (err != null) {
              return callback(err)
            }
            return tpdsUpdateSender.moveEntity(
              {
                project_id,
                project_name: oldProjectName,
                newProjectName: newName
              },
              callback
            )
          }
        )
      })
    })
  },

  MAX_PROJECT_NAME_LENGTH: 150,
  validateProjectName(name, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    if (name == null || name.length === 0) {
      return callback(
        new Errors.InvalidNameError('Project name cannot be blank')
      )
    } else if (name.length > this.MAX_PROJECT_NAME_LENGTH) {
      return callback(new Errors.InvalidNameError('Project name is too long'))
    } else if (name.indexOf('/') > -1) {
      return callback(
        new Errors.InvalidNameError('Project name cannot contain / characters')
      )
    } else if (name.indexOf('\\') > -1) {
      return callback(
        new Errors.InvalidNameError('Project name cannot contain \\ characters')
      )
    } else {
      return callback()
    }
  },

  generateUniqueName(user_id, name, suffixes, callback) {
    if (suffixes == null) {
      suffixes = []
    }
    if (callback == null) {
      callback = function(error, newName) {}
    }
    if (arguments.length === 3 && typeof suffixes === 'function') {
      // make suffixes an optional argument
      callback = suffixes
      suffixes = []
    }
    return ProjectDetailsHandler.ensureProjectNameIsUnique(
      user_id,
      name,
      suffixes,
      callback
    )
  },

  // FIXME: we should put a lock around this to make it completely safe, but we would need to do that at
  // the point of project creation, rather than just checking the name at the start of the import.
  // If we later move this check into ProjectCreationHandler we can ensure all new projects are created
  // with a unique name.  But that requires thinking through how we would handle incoming projects from
  // dropbox for example.
  ensureProjectNameIsUnique(user_id, name, suffixes, callback) {
    if (suffixes == null) {
      suffixes = []
    }
    if (callback == null) {
      callback = function(error, name, changed) {}
    }
    return ProjectGetter.findAllUsersProjects(user_id, { name: 1 }, function(
      error,
      allUsersProjectNames
    ) {
      if (error != null) {
        return callback(error)
      }
      // allUsersProjectNames is returned as a hash {owned: [name1, name2, ...], readOnly: [....]}
      // collect all of the names and flatten them into a single array
      const projectNameList = _.pluck(
        _.flatten(_.values(allUsersProjectNames)),
        'name'
      )
      return ProjectHelper.ensureNameIsUnique(
        projectNameList,
        name,
        suffixes,
        ProjectDetailsHandler.MAX_PROJECT_NAME_LENGTH,
        callback
      )
    })
  },

  fixProjectName(name) {
    if (name === '' || !name) {
      name = 'Untitled'
    }
    if (name.indexOf('/') > -1) {
      // v2 does not allow / in a project name
      name = name.replace(/\//g, '-')
    }
    if (name.indexOf('\\') > -1) {
      // backslashes in project name will prevent syncing to dropbox
      name = name.replace(/\\/g, '')
    }
    if (name.length > this.MAX_PROJECT_NAME_LENGTH) {
      name = name.substr(0, this.MAX_PROJECT_NAME_LENGTH)
    }
    return name
  },

  setPublicAccessLevel(project_id, newAccessLevel, callback) {
    if (callback == null) {
      callback = function() {}
    }
    logger.log({ project_id, level: newAccessLevel }, 'set public access level')
    // DEPRECATED: `READ_ONLY` and `READ_AND_WRITE` are still valid in, but should no longer
    // be passed here. Remove after token-based access has been live for a while
    if (
      project_id != null &&
      newAccessLevel != null &&
      _.include(
        [
          PublicAccessLevels.READ_ONLY,
          PublicAccessLevels.READ_AND_WRITE,
          PublicAccessLevels.PRIVATE,
          PublicAccessLevels.TOKEN_BASED
        ],
        newAccessLevel
      )
    ) {
      return Project.update(
        { _id: project_id },
        { publicAccesLevel: newAccessLevel },
        err => callback(err)
      )
    }
  },

  ensureTokensArePresent(project_id, callback) {
    if (callback == null) {
      callback = function(err, tokens) {}
    }
    return ProjectGetter.getProject(project_id, { tokens: 1 }, function(
      err,
      project
    ) {
      if (err != null) {
        return callback(err)
      }
      if (
        project.tokens != null &&
        project.tokens.readOnly != null &&
        project.tokens.readAndWrite != null
      ) {
        logger.log({ project_id }, 'project already has tokens')
        return callback(null, project.tokens)
      } else {
        logger.log(
          {
            project_id,
            has_tokens: project.tokens != null,
            has_readOnly:
              __guard__(
                project != null ? project.tokens : undefined,
                x => x.readOnly
              ) != null,
            has_readAndWrite:
              __guard__(
                project != null ? project.tokens : undefined,
                x1 => x1.readAndWrite
              ) != null
          },
          'generating tokens for project'
        )
        return ProjectDetailsHandler._generateTokens(project, function(err) {
          if (err != null) {
            return callback(err)
          }
          return Project.update(
            { _id: project_id },
            { $set: { tokens: project.tokens } },
            function(err) {
              if (err != null) {
                return callback(err)
              }
              return callback(null, project.tokens)
            }
          )
        })
      }
    })
  },

  _generateTokens(project, callback) {
    if (callback == null) {
      callback = function(err) {}
    }
    if (!project.tokens) {
      project.tokens = {}
    }
    const { tokens } = project
    if (tokens.readAndWrite == null) {
      const { token, numericPrefix } = ProjectTokenGenerator.readAndWriteToken()
      tokens.readAndWrite = token
      tokens.readAndWritePrefix = numericPrefix
    }
    if (tokens.readOnly == null) {
      return ProjectTokenGenerator.generateUniqueReadOnlyToken(function(
        err,
        token
      ) {
        if (err != null) {
          return callback(err)
        }
        tokens.readOnly = token
        return callback()
      })
    } else {
      return callback()
    }
  }
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
