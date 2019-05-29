/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let AuthorizationManager
const CollaboratorsHandler = require('../Collaborators/CollaboratorsHandler')
const ProjectGetter = require('../Project/ProjectGetter')
const { User } = require('../../models/User')
const PrivilegeLevels = require('./PrivilegeLevels')
const PublicAccessLevels = require('./PublicAccessLevels')
const Errors = require('../Errors/Errors')
const { ObjectId } = require('mongojs')
const TokenAccessHandler = require('../TokenAccess/TokenAccessHandler')

module.exports = AuthorizationManager = {
  getPublicAccessLevel(project_id, callback) {
    if (callback == null) {
      callback = function(err, level) {}
    }
    if (!ObjectId.isValid(project_id)) {
      return callback(new Error('invalid project id'))
    }
    // Note, the Project property in the DB is `publicAccesLevel`, without the second `s`
    return ProjectGetter.getProject(
      project_id,
      { publicAccesLevel: 1 },
      function(error, project) {
        if (error != null) {
          return callback(error)
        }
        if (project == null) {
          return callback(
            new Errors.NotFoundError(`no project found with id ${project_id}`)
          )
        }
        return callback(null, project.publicAccesLevel)
      }
    )
  },

  // Get the privilege level that the user has for the project
  // Returns:
  //	* privilegeLevel: "owner", "readAndWrite", of "readOnly" if the user has
  //	  access. false if the user does not have access
  //   * becausePublic: true if the access level is only because the project is public.
  //   * becauseSiteAdmin: true if access level is only because user is admin
  getPrivilegeLevelForProject(user_id, project_id, token, callback) {
    if (callback == null) {
      callback = function(
        error,
        privilegeLevel,
        becausePublic,
        becauseSiteAdmin
      ) {}
    }
    if (user_id == null) {
      // User is Anonymous, Try Token-based access
      return AuthorizationManager.getPublicAccessLevel(project_id, function(
        err,
        publicAccessLevel
      ) {
        if (err != null) {
          return callback(err)
        }
        if (publicAccessLevel === PublicAccessLevels.TOKEN_BASED) {
          // Anonymous users can have read-only access to token-based projects,
          // while read-write access must be logged in,
          // unless the `enableAnonymousReadAndWriteSharing` setting is enabled
          return TokenAccessHandler.isValidToken(project_id, token, function(
            err,
            isValidReadAndWrite,
            isValidReadOnly
          ) {
            if (err != null) {
              return callback(err)
            }
            if (isValidReadOnly) {
              // Grant anonymous user read-only access
              return callback(null, PrivilegeLevels.READ_ONLY, false, false)
            } else if (
              isValidReadAndWrite &&
              TokenAccessHandler.ANONYMOUS_READ_AND_WRITE_ENABLED
            ) {
              // Grant anonymous user read-and-write access
              return callback(
                null,
                PrivilegeLevels.READ_AND_WRITE,
                false,
                false
              )
            } else {
              // Deny anonymous access
              return callback(null, PrivilegeLevels.NONE, false, false)
            }
          })
        } else if (publicAccessLevel === PublicAccessLevels.READ_ONLY) {
          // Legacy public read-only access for anonymous user
          return callback(null, PrivilegeLevels.READ_ONLY, true, false)
        } else if (publicAccessLevel === PublicAccessLevels.READ_AND_WRITE) {
          // Legacy public read-write access for anonymous user
          return callback(null, PrivilegeLevels.READ_AND_WRITE, true, false)
        } else {
          // Deny anonymous user access
          return callback(null, PrivilegeLevels.NONE, false, false)
        }
      })
    } else {
      // User is present, get their privilege level from database
      return CollaboratorsHandler.getMemberIdPrivilegeLevel(
        user_id,
        project_id,
        function(error, privilegeLevel) {
          if (error != null) {
            return callback(error)
          }
          if (
            privilegeLevel != null &&
            privilegeLevel !== PrivilegeLevels.NONE
          ) {
            // The user has direct access
            return callback(null, privilegeLevel, false, false)
          } else {
            return AuthorizationManager.isUserSiteAdmin(user_id, function(
              error,
              isAdmin
            ) {
              if (error != null) {
                return callback(error)
              }
              if (isAdmin) {
                return callback(null, PrivilegeLevels.OWNER, false, true)
              } else {
                // Legacy public-access system
                // User is present (not anonymous), but does not have direct access
                return AuthorizationManager.getPublicAccessLevel(
                  project_id,
                  function(err, publicAccessLevel) {
                    if (err != null) {
                      return callback(err)
                    }
                    if (publicAccessLevel === PublicAccessLevels.READ_ONLY) {
                      return callback(
                        null,
                        PrivilegeLevels.READ_ONLY,
                        true,
                        false
                      )
                    } else if (
                      publicAccessLevel === PublicAccessLevels.READ_AND_WRITE
                    ) {
                      return callback(
                        null,
                        PrivilegeLevels.READ_AND_WRITE,
                        true,
                        false
                      )
                    } else {
                      return callback(null, PrivilegeLevels.NONE, false, false)
                    }
                  }
                )
              }
            })
          }
        }
      )
    }
  },

  canUserReadProject(user_id, project_id, token, callback) {
    if (callback == null) {
      callback = function(error, canRead) {}
    }
    return AuthorizationManager.getPrivilegeLevelForProject(
      user_id,
      project_id,
      token,
      function(error, privilegeLevel) {
        if (error != null) {
          return callback(error)
        }
        return callback(
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

  canUserWriteProjectContent(user_id, project_id, token, callback) {
    if (callback == null) {
      callback = function(error, canWriteContent) {}
    }
    return AuthorizationManager.getPrivilegeLevelForProject(
      user_id,
      project_id,
      token,
      function(error, privilegeLevel) {
        if (error != null) {
          return callback(error)
        }
        return callback(
          null,
          [PrivilegeLevels.OWNER, PrivilegeLevels.READ_AND_WRITE].includes(
            privilegeLevel
          )
        )
      }
    )
  },

  canUserWriteProjectSettings(user_id, project_id, token, callback) {
    if (callback == null) {
      callback = function(error, canWriteSettings) {}
    }
    return AuthorizationManager.getPrivilegeLevelForProject(
      user_id,
      project_id,
      token,
      function(error, privilegeLevel, becausePublic) {
        if (error != null) {
          return callback(error)
        }
        if (privilegeLevel === PrivilegeLevels.OWNER) {
          return callback(null, true)
        } else if (
          privilegeLevel === PrivilegeLevels.READ_AND_WRITE &&
          !becausePublic
        ) {
          return callback(null, true)
        } else {
          return callback(null, false)
        }
      }
    )
  },

  canUserAdminProject(user_id, project_id, token, callback) {
    if (callback == null) {
      callback = function(error, canAdmin, becauseSiteAdmin) {}
    }
    return AuthorizationManager.getPrivilegeLevelForProject(
      user_id,
      project_id,
      token,
      function(error, privilegeLevel, becausePublic, becauseSiteAdmin) {
        if (error != null) {
          return callback(error)
        }
        return callback(
          null,
          privilegeLevel === PrivilegeLevels.OWNER,
          becauseSiteAdmin
        )
      }
    )
  },

  isUserSiteAdmin(user_id, callback) {
    if (callback == null) {
      callback = function(error, isAdmin) {}
    }
    if (user_id == null) {
      return callback(null, false)
    }
    return User.findOne({ _id: user_id }, { isAdmin: 1 }, function(
      error,
      user
    ) {
      if (error != null) {
        return callback(error)
      }
      return callback(null, (user != null ? user.isAdmin : undefined) === true)
    })
  }
}
