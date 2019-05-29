/* eslint-disable
    handle-callback-err,
    max-len,
    no-return-assign,
    node/no-deprecated-api,
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
let TokenAccessHandler
const { Project } = require('../../models/Project')
const CollaboratorsHandler = require('../Collaborators/CollaboratorsHandler')
const PublicAccessLevels = require('../Authorization/PublicAccessLevels')
const PrivilegeLevels = require('../Authorization/PrivilegeLevels')
const UserGetter = require('../User/UserGetter')
const { ObjectId } = require('mongojs')
const Settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')
const V1Api = require('../V1/V1Api')
const crypto = require('crypto')

module.exports = TokenAccessHandler = {
  ANONYMOUS_READ_AND_WRITE_ENABLED:
    Settings.allowAnonymousReadAndWriteSharing === true,

  _extractNumericPrefix(token) {
    return token.match(/^(\d+)\w+/)
  },

  _getProjectByReadOnlyToken(token, callback) {
    if (callback == null) {
      callback = function(err, project) {}
    }
    return Project.findOne(
      {
        'tokens.readOnly': token
      },
      { _id: 1, tokens: 1, publicAccesLevel: 1, owner_ref: 1 },
      callback
    )
  },

  _getProjectByEitherToken(token, callback) {
    if (callback == null) {
      callback = function(err, project) {}
    }
    return TokenAccessHandler._getProjectByReadOnlyToken(token, function(
      err,
      project
    ) {
      if (err != null) {
        return callback(err)
      }
      if (project != null) {
        return callback(null, project)
      }
      return TokenAccessHandler._getProjectByReadAndWriteToken(token, function(
        err,
        project
      ) {
        if (err != null) {
          return callback(err)
        }
        return callback(null, project)
      })
    })
  },

  _getProjectByReadAndWriteToken(token, callback) {
    if (callback == null) {
      callback = function(err, project) {}
    }
    const numericPrefixMatch = TokenAccessHandler._extractNumericPrefix(token)
    if (!numericPrefixMatch) {
      return callback(null, null)
    }
    const numerics = numericPrefixMatch[1]
    return Project.findOne(
      {
        'tokens.readAndWritePrefix': numerics
      },
      { _id: 1, tokens: 1, publicAccesLevel: 1, owner_ref: 1 },
      function(err, project) {
        if (err != null) {
          return callback(err)
        }
        if (project == null) {
          return callback(null, null)
        }
        try {
          if (
            !crypto.timingSafeEqual(
              new Buffer(token),
              new Buffer(project.tokens.readAndWrite)
            )
          ) {
            logger.err(
              { token },
              'read-and-write token match on numeric section, but not on full token'
            )
            return callback(null, null)
          } else {
            return callback(null, project)
          }
        } catch (error) {
          err = error
          logger.err({ token, cryptoErr: err }, 'error comparing tokens')
          return callback(null, null)
        }
      }
    )
  },

  findProjectWithReadOnlyToken(token, callback) {
    if (callback == null) {
      callback = function(err, project, projectExists) {}
    }
    return TokenAccessHandler._getProjectByReadOnlyToken(token, function(
      err,
      project
    ) {
      if (err != null) {
        return callback(err)
      }
      if (project == null) {
        return callback(null, null, false) // Project doesn't exist, so we handle differently
      }
      if (project.publicAccesLevel !== PublicAccessLevels.TOKEN_BASED) {
        return callback(null, null, true) // Project does exist, but it isn't token based
      }
      return callback(null, project, true)
    })
  },

  findProjectWithReadAndWriteToken(token, callback) {
    if (callback == null) {
      callback = function(err, project, projectExists) {}
    }
    return TokenAccessHandler._getProjectByReadAndWriteToken(token, function(
      err,
      project
    ) {
      if (err != null) {
        return callback(err)
      }
      if (project == null) {
        return callback(null, null, false) // Project doesn't exist, so we handle differently
      }
      if (project.publicAccesLevel !== PublicAccessLevels.TOKEN_BASED) {
        return callback(null, null, true) // Project does exist, but it isn't token based
      }
      return callback(null, project, true)
    })
  },

  _userIsMember(userId, projectId, callback) {
    if (callback == null) {
      callback = function(err, isMember) {}
    }
    return CollaboratorsHandler.isUserInvitedMemberOfProject(
      userId,
      projectId,
      callback
    )
  },

  findProjectWithHigherAccess(token, userId, callback) {
    if (callback == null) {
      callback = function(err, project) {}
    }
    return TokenAccessHandler._getProjectByEitherToken(token, function(
      err,
      project
    ) {
      if (err != null) {
        return callback(err)
      }
      if (project == null) {
        return callback(null, null)
      }
      const projectId = project._id
      return TokenAccessHandler._userIsMember(userId, projectId, function(
        err,
        isMember
      ) {
        if (err != null) {
          return callback(err)
        }
        return callback(null, isMember === true ? project : null)
      })
    })
  },

  addReadOnlyUserToProject(userId, projectId, callback) {
    if (callback == null) {
      callback = function(err) {}
    }
    userId = ObjectId(userId.toString())
    projectId = ObjectId(projectId.toString())
    return Project.update(
      {
        _id: projectId
      },
      {
        $addToSet: { tokenAccessReadOnly_refs: userId }
      },
      callback
    )
  },

  addReadAndWriteUserToProject(userId, projectId, callback) {
    if (callback == null) {
      callback = function(err) {}
    }
    userId = ObjectId(userId.toString())
    projectId = ObjectId(projectId.toString())
    return Project.update(
      {
        _id: projectId
      },
      {
        $addToSet: { tokenAccessReadAndWrite_refs: userId }
      },
      callback
    )
  },

  grantSessionTokenAccess(req, projectId, token) {
    if (req.session != null) {
      if (req.session.anonTokenAccess == null) {
        req.session.anonTokenAccess = {}
      }
      return (req.session.anonTokenAccess[
        projectId.toString()
      ] = token.toString())
    }
  },

  getRequestToken(req, projectId) {
    const token =
      __guard__(
        __guard__(
          req != null ? req.session : undefined,
          x1 => x1.anonTokenAccess
        ),
        x => x[projectId.toString()]
      ) ||
      (req != null ? req.headers['x-sl-anonymous-access-token'] : undefined)
    return token
  },

  isValidToken(projectId, token, callback) {
    if (callback == null) {
      callback = function(err, isValidReadAndWrite, isValidReadOnly) {}
    }
    if (!token) {
      return callback(null, false, false)
    }
    const _validate = project =>
      project != null &&
      project.publicAccesLevel === PublicAccessLevels.TOKEN_BASED &&
      project._id.toString() === projectId.toString()
    return TokenAccessHandler.findProjectWithReadAndWriteToken(token, function(
      err,
      readAndWriteProject
    ) {
      if (err != null) {
        return callback(err)
      }
      const isValidReadAndWrite = _validate(readAndWriteProject)
      return TokenAccessHandler.findProjectWithReadOnlyToken(token, function(
        err,
        readOnlyProject
      ) {
        if (err != null) {
          return callback(err)
        }
        const isValidReadOnly = _validate(readOnlyProject)
        return callback(null, isValidReadAndWrite, isValidReadOnly)
      })
    })
  },

  protectTokens(project, privilegeLevel) {
    if (project != null && project.tokens != null) {
      if (privilegeLevel === PrivilegeLevels.OWNER) {
        return
      }
      if (privilegeLevel !== PrivilegeLevels.READ_AND_WRITE) {
        project.tokens.readAndWrite = ''
        project.tokens.readAndWritePrefix = ''
      }
      if (privilegeLevel !== PrivilegeLevels.READ_ONLY) {
        return (project.tokens.readOnly = '')
      }
    }
  },

  getV1DocPublishedInfo(token, callback) {
    // default to allowing access
    if (callback == null) {
      callback = function(err, publishedInfo) {}
    }
    if ((Settings.apis != null ? Settings.apis.v1 : undefined) == null) {
      return callback(null, {
        allow: true
      })
    }

    return V1Api.request(
      { url: `/api/v1/sharelatex/docs/${token}/is_published` },
      function(err, response, body) {
        if (err != null) {
          return callback(err)
        }
        return callback(null, body)
      }
    )
  },

  getV1DocInfo(token, v2UserId, callback) {
    // default to not exported
    if (callback == null) {
      callback = function(err, info) {}
    }
    if ((Settings.apis != null ? Settings.apis.v1 : undefined) == null) {
      return callback(null, {
        exists: true,
        exported: false
      })
    }

    return UserGetter.getUser(v2UserId, { overleaf: 1 }, function(err, user) {
      if (err != null) {
        return callback(err)
      }
      const v1UserId = user.overleaf != null ? user.overleaf.id : undefined
      return V1Api.request(
        { url: `/api/v1/sharelatex/users/${v1UserId}/docs/${token}/info` },
        function(err, response, body) {
          if (err != null) {
            return callback(err)
          }
          return callback(null, body)
        }
      )
    })
  }
}

module.exports.READ_AND_WRITE_TOKEN_REGEX = /^(\d+)(\w+)$/
module.exports.READ_AND_WRITE_URL_REGEX = /^\/(\d+)(\w+)$/
module.exports.READ_ONLY_TOKEN_REGEX = /^([a-z]{12})$/
module.exports.READ_ONLY_URL_REGEX = /^\/read\/([a-z]{12})$/

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
