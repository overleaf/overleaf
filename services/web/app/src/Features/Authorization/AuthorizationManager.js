let AuthorizationManager
const CollaboratorsGetter = require('../Collaborators/CollaboratorsGetter')
const CollaboratorsHandler = require('../Collaborators/CollaboratorsHandler')
const ProjectGetter = require('../Project/ProjectGetter')
const { User } = require('../../models/User')
const PrivilegeLevels = require('./PrivilegeLevels')
const PublicAccessLevels = require('./PublicAccessLevels')
const Errors = require('../Errors/Errors')
const { ObjectId } = require('mongojs')
const TokenAccessHandler = require('../TokenAccess/TokenAccessHandler')

module.exports = AuthorizationManager = {
  isRestrictedUser(userId, privilegeLevel, isTokenMember) {
    if (privilegeLevel === PrivilegeLevels.NONE) {
      return true
    }
    return (
      privilegeLevel === PrivilegeLevels.READ_ONLY && (isTokenMember || !userId)
    )
  },

  isRestrictedUserForProject(userId, projectId, token, callback) {
    this.getPrivilegeLevelForProject(
      userId,
      projectId,
      token,
      (err, privilegeLevel) => {
        if (err) {
          return callback(err)
        }
        CollaboratorsHandler.userIsTokenMember(
          userId,
          projectId,
          (err, isTokenMember) => {
            if (err) {
              return callback(err)
            }
            callback(
              null,
              this.isRestrictedUser(userId, privilegeLevel, isTokenMember)
            )
          }
        )
      }
    )
  },

  getPublicAccessLevel(projectId, callback) {
    if (!ObjectId.isValid(projectId)) {
      return callback(new Error('invalid project id'))
    }
    // Note, the Project property in the DB is `publicAccesLevel`, without the second `s`
    ProjectGetter.getProject(projectId, { publicAccesLevel: 1 }, function(
      error,
      project
    ) {
      if (error) {
        return callback(error)
      }
      if (!project) {
        return callback(
          new Errors.NotFoundError(`no project found with id ${projectId}`)
        )
      }
      callback(null, project.publicAccesLevel)
    })
  },

  // Get the privilege level that the user has for the project
  // Returns:
  //	* privilegeLevel: "owner", "readAndWrite", of "readOnly" if the user has
  //	  access. false if the user does not have access
  //   * becausePublic: true if the access level is only because the project is public.
  //   * becauseSiteAdmin: true if access level is only because user is admin
  getPrivilegeLevelForProject(userId, projectId, token, callback) {
    if (userId) {
      AuthorizationManager.getPrivilegeLevelForProjectWithUser(
        userId,
        projectId,
        token,
        callback
      )
    } else {
      AuthorizationManager.getPrivilegeLevelForProjectWithoutUser(
        projectId,
        token,
        callback
      )
    }
  },

  // User is present, get their privilege level from database
  getPrivilegeLevelForProjectWithUser(userId, projectId, token, callback) {
    CollaboratorsGetter.getMemberIdPrivilegeLevel(userId, projectId, function(
      error,
      privilegeLevel
    ) {
      if (error) {
        return callback(error)
      }
      if (privilegeLevel && privilegeLevel !== PrivilegeLevels.NONE) {
        // The user has direct access
        return callback(null, privilegeLevel, false, false)
      }
      AuthorizationManager.isUserSiteAdmin(userId, function(error, isAdmin) {
        if (error) {
          return callback(error)
        }
        if (isAdmin) {
          return callback(null, PrivilegeLevels.OWNER, false, true)
        }
        // Legacy public-access system
        // User is present (not anonymous), but does not have direct access
        AuthorizationManager.getPublicAccessLevel(projectId, function(
          err,
          publicAccessLevel
        ) {
          if (err) {
            return callback(err)
          }
          if (publicAccessLevel === PublicAccessLevels.READ_ONLY) {
            return callback(null, PrivilegeLevels.READ_ONLY, true, false)
          }
          if (publicAccessLevel === PublicAccessLevels.READ_AND_WRITE) {
            return callback(null, PrivilegeLevels.READ_AND_WRITE, true, false)
          }
          callback(null, PrivilegeLevels.NONE, false, false)
        })
      })
    })
  },

  // User is Anonymous, Try Token-based access
  getPrivilegeLevelForProjectWithoutUser(projectId, token, callback) {
    AuthorizationManager.getPublicAccessLevel(projectId, function(
      err,
      publicAccessLevel
    ) {
      if (err) {
        return callback(err)
      }
      if (publicAccessLevel === PublicAccessLevels.READ_ONLY) {
        // Legacy public read-only access for anonymous user
        return callback(null, PrivilegeLevels.READ_ONLY, true, false)
      }
      if (publicAccessLevel === PublicAccessLevels.READ_AND_WRITE) {
        // Legacy public read-write access for anonymous user
        return callback(null, PrivilegeLevels.READ_AND_WRITE, true, false)
      }
      if (publicAccessLevel === PublicAccessLevels.TOKEN_BASED) {
        return AuthorizationManager.getPrivilegeLevelForProjectWithToken(
          projectId,
          token,
          callback
        )
      }
      // Deny anonymous user access
      callback(null, PrivilegeLevels.NONE, false, false)
    })
  },

  getPrivilegeLevelForProjectWithToken(projectId, token, callback) {
    // Anonymous users can have read-only access to token-based projects,
    // while read-write access must be logged in,
    // unless the `enableAnonymousReadAndWriteSharing` setting is enabled
    TokenAccessHandler.isValidToken(projectId, token, function(
      err,
      isValidReadAndWrite,
      isValidReadOnly
    ) {
      if (err) {
        return callback(err)
      }
      if (isValidReadOnly) {
        // Grant anonymous user read-only access
        return callback(null, PrivilegeLevels.READ_ONLY, false, false)
      }
      if (
        isValidReadAndWrite &&
        TokenAccessHandler.ANONYMOUS_READ_AND_WRITE_ENABLED
      ) {
        // Grant anonymous user read-and-write access
        return callback(null, PrivilegeLevels.READ_AND_WRITE, false, false)
      }
      // Deny anonymous access
      callback(null, PrivilegeLevels.NONE, false, false)
    })
  },

  canUserReadProject(userId, projectId, token, callback) {
    AuthorizationManager.getPrivilegeLevelForProject(
      userId,
      projectId,
      token,
      function(error, privilegeLevel) {
        if (error) {
          return callback(error)
        }
        callback(
          null,
          [
            PrivilegeLevels.OWNER,
            PrivilegeLevels.READ_AND_WRITE,
            PrivilegeLevels.READ_ONLY
          ].includes(privilegeLevel)
        )
      }
    )
  },

  canUserWriteProjectContent(userId, projectId, token, callback) {
    AuthorizationManager.getPrivilegeLevelForProject(
      userId,
      projectId,
      token,
      function(error, privilegeLevel) {
        if (error) {
          return callback(error)
        }
        callback(
          null,
          [PrivilegeLevels.OWNER, PrivilegeLevels.READ_AND_WRITE].includes(
            privilegeLevel
          )
        )
      }
    )
  },

  canUserWriteProjectSettings(userId, projectId, token, callback) {
    AuthorizationManager.getPrivilegeLevelForProject(
      userId,
      projectId,
      token,
      function(error, privilegeLevel, becausePublic) {
        if (error) {
          return callback(error)
        }
        if (privilegeLevel === PrivilegeLevels.OWNER) {
          return callback(null, true)
        }
        if (
          privilegeLevel === PrivilegeLevels.READ_AND_WRITE &&
          !becausePublic
        ) {
          return callback(null, true)
        }
        callback(null, false)
      }
    )
  },

  canUserAdminProject(userId, projectId, token, callback) {
    AuthorizationManager.getPrivilegeLevelForProject(
      userId,
      projectId,
      token,
      function(error, privilegeLevel, becausePublic, becauseSiteAdmin) {
        if (error) {
          return callback(error)
        }
        callback(
          null,
          privilegeLevel === PrivilegeLevels.OWNER,
          becauseSiteAdmin
        )
      }
    )
  },

  isUserSiteAdmin(userId, callback) {
    if (!userId) {
      return callback(null, false)
    }
    User.findOne({ _id: userId }, { isAdmin: 1 }, function(error, user) {
      if (error) {
        return callback(error)
      }
      callback(null, (user && user.isAdmin) === true)
    })
  }
}
