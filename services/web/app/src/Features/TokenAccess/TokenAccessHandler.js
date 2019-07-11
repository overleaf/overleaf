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

const TokenAccessHandler = {
  ANONYMOUS_READ_AND_WRITE_ENABLED:
    Settings.allowAnonymousReadAndWriteSharing === true,
  READ_AND_WRITE_TOKEN_REGEX: /^(\d+)(\w+)$/,
  READ_AND_WRITE_URL_REGEX: /^\/(\d+)(\w+)$/,
  READ_ONLY_TOKEN_REGEX: /^([a-z]{12})$/,
  READ_ONLY_URL_REGEX: /^\/read\/([a-z]{12})$/,

  _extractNumericPrefix(token) {
    return token.match(/^(\d+)\w+/)
  },

  _getProjectByReadOnlyToken(token, callback) {
    Project.findOne(
      {
        'tokens.readOnly': token
      },
      { _id: 1, tokens: 1, publicAccesLevel: 1, owner_ref: 1 },
      callback
    )
  },

  _getProjectByEitherToken(token, callback) {
    TokenAccessHandler._getProjectByReadOnlyToken(token, function(
      err,
      project
    ) {
      if (err != null) {
        return callback(err)
      }
      if (project != null) {
        return callback(null, project)
      }
      TokenAccessHandler._getProjectByReadAndWriteToken(token, function(
        err,
        project
      ) {
        if (err != null) {
          return callback(err)
        }
        callback(null, project)
      })
    })
  },

  _getProjectByReadAndWriteToken(token, callback) {
    const numericPrefixMatch = TokenAccessHandler._extractNumericPrefix(token)
    if (!numericPrefixMatch) {
      return callback(null, null)
    }
    const numerics = numericPrefixMatch[1]
    Project.findOne(
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
              Buffer.from(token),
              Buffer.from(project.tokens.readAndWrite)
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
    TokenAccessHandler._getProjectByReadOnlyToken(token, function(
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
      callback(null, project, true)
    })
  },

  findProjectWithReadAndWriteToken(token, callback) {
    TokenAccessHandler._getProjectByReadAndWriteToken(token, function(
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
      callback(null, project, true)
    })
  },

  _userIsMember(userId, projectId, callback) {
    CollaboratorsHandler.isUserInvitedMemberOfProject(
      userId,
      projectId,
      callback
    )
  },

  findProjectWithHigherAccess(token, userId, callback) {
    TokenAccessHandler._getProjectByEitherToken(token, function(err, project) {
      if (err != null) {
        return callback(err)
      }
      if (project == null) {
        return callback(null, null)
      }
      const projectId = project._id
      TokenAccessHandler._userIsMember(userId, projectId, function(
        err,
        isMember
      ) {
        if (err != null) {
          return callback(err)
        }
        callback(null, isMember === true ? project : null)
      })
    })
  },

  addReadOnlyUserToProject(userId, projectId, callback) {
    userId = ObjectId(userId.toString())
    projectId = ObjectId(projectId.toString())
    Project.update(
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
    userId = ObjectId(userId.toString())
    projectId = ObjectId(projectId.toString())
    Project.update(
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
    if (!req.session) {
      return
    }
    if (!req.session.anonTokenAccess) {
      req.session.anonTokenAccess = {}
    }
    req.session.anonTokenAccess[projectId.toString()] = token.toString()
  },

  getRequestToken(req, projectId) {
    const token =
      (req.session &&
        req.session.anonTokenAccess &&
        req.session.anonTokenAccess[projectId.toString()]) ||
      req.headers['x-sl-anonymous-access-token']
    return token
  },

  isValidToken(projectId, token, callback) {
    if (!token) {
      return callback(null, false, false)
    }
    const _validate = project =>
      project != null &&
      project.publicAccesLevel === PublicAccessLevels.TOKEN_BASED &&
      project._id.toString() === projectId.toString()
    TokenAccessHandler.findProjectWithReadAndWriteToken(token, function(
      err,
      readAndWriteProject
    ) {
      if (err != null) {
        return callback(err)
      }
      const isValidReadAndWrite = _validate(readAndWriteProject)
      TokenAccessHandler.findProjectWithReadOnlyToken(token, function(
        err,
        readOnlyProject
      ) {
        if (err != null) {
          return callback(err)
        }
        const isValidReadOnly = _validate(readOnlyProject)
        callback(null, isValidReadAndWrite, isValidReadOnly)
      })
    })
  },

  protectTokens(project, privilegeLevel) {
    if (!project || !project.tokens) {
      return
    }
    if (privilegeLevel === PrivilegeLevels.OWNER) {
      return
    }
    if (privilegeLevel !== PrivilegeLevels.READ_AND_WRITE) {
      project.tokens.readAndWrite = ''
      project.tokens.readAndWritePrefix = ''
    }
    if (privilegeLevel !== PrivilegeLevels.READ_ONLY) {
      project.tokens.readOnly = ''
    }
  },

  getV1DocPublishedInfo(token, callback) {
    // default to allowing access
    if (!Settings.apis || !Settings.apis.v1) {
      return callback(null, { allow: true })
    }
    V1Api.request(
      { url: `/api/v1/sharelatex/docs/${token}/is_published` },
      function(err, response, body) {
        if (err != null) {
          return callback(err)
        }
        callback(null, body)
      }
    )
  },

  getV1DocInfo(token, v2UserId, callback) {
    if (!Settings.apis || !Settings.apis.v1) {
      return callback(null, {
        exists: true,
        exported: false
      })
    }
    UserGetter.getUser(v2UserId, { overleaf: 1 }, function(err, user) {
      if (err != null) {
        return callback(err)
      }
      const v1UserId = user.overleaf != null ? user.overleaf.id : undefined
      if (!v1UserId) {
        return callback(null, null)
      }
      V1Api.request(
        { url: `/api/v1/sharelatex/users/${v1UserId}/docs/${token}/info` },
        function(err, response, body) {
          if (err != null) {
            return callback(err)
          }
          callback(null, body)
        }
      )
    })
  }
}

module.exports = TokenAccessHandler
