const { Project } = require('../../models/Project')
const PublicAccessLevels = require('../Authorization/PublicAccessLevels')
const PrivilegeLevels = require('../Authorization/PrivilegeLevels')
const { ObjectId } = require('mongodb-legacy')
const Metrics = require('@overleaf/metrics')
const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
const V1Api = require('../V1/V1Api')
const crypto = require('crypto')
const { callbackifyAll } = require('@overleaf/promise-utils')
const Analytics = require('../Analytics/AnalyticsManager')

const READ_AND_WRITE_TOKEN_PATTERN = '([0-9]+[a-z]{6,12})'
const READ_ONLY_TOKEN_PATTERN = '([a-z]{12})'

const TokenAccessHandler = {
  TOKEN_TYPES: {
    READ_ONLY: PrivilegeLevels.READ_ONLY,
    READ_AND_WRITE: PrivilegeLevels.READ_AND_WRITE,
  },

  ANONYMOUS_READ_AND_WRITE_ENABLED:
    Settings.allowAnonymousReadAndWriteSharing === true,

  READ_AND_WRITE_TOKEN_PATTERN,
  READ_ONLY_TOKEN_PATTERN,

  _makeReadAndWriteTokenUrl(token) {
    return `/${token}`
  },

  _makeReadOnlyTokenUrl(token) {
    return `/read/${token}`
  },

  makeTokenUrl(token) {
    const tokenType = TokenAccessHandler.getTokenType(token)
    if (tokenType === TokenAccessHandler.TOKEN_TYPES.READ_AND_WRITE) {
      return TokenAccessHandler._makeReadAndWriteTokenUrl(token)
    } else if (tokenType === TokenAccessHandler.TOKEN_TYPES.READ_ONLY) {
      return TokenAccessHandler._makeReadOnlyTokenUrl(token)
    } else {
      throw new Error('invalid token type')
    }
  },

  getTokenType(token) {
    if (!token) {
      return null
    }
    if (token.match(`^${TokenAccessHandler.READ_ONLY_TOKEN_PATTERN}$`)) {
      return TokenAccessHandler.TOKEN_TYPES.READ_ONLY
    } else if (
      token.match(`^${TokenAccessHandler.READ_AND_WRITE_TOKEN_PATTERN}$`)
    ) {
      return TokenAccessHandler.TOKEN_TYPES.READ_AND_WRITE
    }
    return null
  },

  isReadOnlyToken(token) {
    return (
      TokenAccessHandler.getTokenType(token) ===
      TokenAccessHandler.TOKEN_TYPES.READ_ONLY
    )
  },

  isReadAndWriteToken(token) {
    return (
      TokenAccessHandler.getTokenType(token) ===
      TokenAccessHandler.TOKEN_TYPES.READ_AND_WRITE
    )
  },

  isValidToken(token) {
    return TokenAccessHandler.getTokenType(token) != null
  },

  tokenAccessEnabledForProject(project) {
    return project.publicAccesLevel === PublicAccessLevels.TOKEN_BASED
  },

  async _projectFindOne(query) {
    return await Project.findOne(query, {
      _id: 1,
      tokens: 1,
      publicAccesLevel: 1,
      owner_ref: 1,
      name: 1,
      tokenAccessReadOnly_refs: 1,
      tokenAccessReadAndWrite_refs: 1,
    }).exec()
  },

  async getProjectByReadOnlyToken(token) {
    return await TokenAccessHandler._projectFindOne({
      'tokens.readOnly': token,
    })
  },

  _extractNumericPrefix(token) {
    return token.match(/^(\d+)\w+/)
  },

  _extractStringSuffix(token) {
    return token.match(/^\d+(\w+)/)
  },

  async getProjectByReadAndWriteToken(token) {
    const numericPrefixMatch = TokenAccessHandler._extractNumericPrefix(token)
    if (!numericPrefixMatch) {
      return null
    }
    const numerics = numericPrefixMatch[1]

    const project = await TokenAccessHandler._projectFindOne({
      'tokens.readAndWritePrefix': numerics,
    })

    if (project == null) {
      return null
    }

    try {
      if (
        !crypto.timingSafeEqual(
          Buffer.from(token),
          Buffer.from(project.tokens.readAndWrite)
        )
      ) {
        logger.err(
          { projectId: project._id },
          'read-and-write token match on numeric section, but not on full token'
        )
        return null
      } else {
        return project
      }
    } catch (error) {
      logger.err({ projectId: project._id, error }, 'error comparing tokens')
      return null
    }
  },

  async getProjectByToken(tokenType, token) {
    if (tokenType === TokenAccessHandler.TOKEN_TYPES.READ_ONLY) {
      return await TokenAccessHandler.getProjectByReadOnlyToken(token)
    } else if (tokenType === TokenAccessHandler.TOKEN_TYPES.READ_AND_WRITE) {
      return await TokenAccessHandler.getProjectByReadAndWriteToken(token)
    }
    throw new Error('invalid token type')
  },

  async addReadOnlyUserToProject(userId, projectId) {
    userId = new ObjectId(userId.toString())
    projectId = new ObjectId(projectId.toString())
    Analytics.recordEventForUserInBackground(userId, 'project-joined', {
      mode: 'read-only',
      projectId: projectId.toString(),
    })

    return await Project.updateOne(
      {
        _id: projectId,
      },
      {
        $addToSet: { tokenAccessReadOnly_refs: userId },
      }
    ).exec()
  },

  async removeReadAndWriteUserFromProject(userId, projectId) {
    userId = new ObjectId(userId.toString())
    projectId = new ObjectId(projectId.toString())

    return await Project.updateOne(
      {
        _id: projectId,
      },
      {
        $pull: { tokenAccessReadAndWrite_refs: userId },
      }
    ).exec()
  },

  async moveReadAndWriteUserToReadOnly(userId, projectId) {
    userId = new ObjectId(userId.toString())
    projectId = new ObjectId(projectId.toString())

    return await Project.updateOne(
      {
        _id: projectId,
      },
      {
        $pull: { tokenAccessReadAndWrite_refs: userId },
        $addToSet: { tokenAccessReadOnly_refs: userId },
      }
    ).exec()
  },

  grantSessionTokenAccess(req, projectId, token) {
    if (!req.session) {
      return
    }
    if (!req.session.anonTokenAccess) {
      req.session.anonTokenAccess = {}
    }
    req.session.anonTokenAccess[projectId.toString()] = token
  },

  getRequestToken(req, projectId) {
    const token =
      req.session &&
      req.session.anonTokenAccess &&
      req.session.anonTokenAccess[projectId.toString()]
    return token
  },

  async validateTokenForAnonymousAccess(projectId, token, callback) {
    if (!token) {
      return { isValidReadAndWrite: false, isValidReadOnly: false }
    }

    const tokenType = TokenAccessHandler.getTokenType(token)
    if (!tokenType) {
      throw new Error('invalid token type')
    }

    const project = await TokenAccessHandler.getProjectByToken(tokenType, token)

    if (
      !project ||
      !TokenAccessHandler.tokenAccessEnabledForProject(project) ||
      project._id.toString() !== projectId.toString()
    ) {
      return { isValidReadAndWrite: false, isValidReadOnly: false }
    }

    // TODO: think about cleaning up this interface and its usage in AuthorizationManager
    return {
      isValidReadAndWrite:
        tokenType === TokenAccessHandler.TOKEN_TYPES.READ_AND_WRITE &&
        TokenAccessHandler.ANONYMOUS_READ_AND_WRITE_ENABLED,
      isValidReadOnly: tokenType === TokenAccessHandler.TOKEN_TYPES.READ_ONLY,
    }
  },

  async getV1DocPublishedInfo(token) {
    // default to allowing access
    if (!Settings.apis.v1 || !Settings.apis.v1.url) {
      return { allow: true }
    }

    const { body } = await V1Api.promises.request({
      url: `/api/v1/overleaf/docs/${token}/is_published`,
    })
    return body
  },

  async getV1DocInfo(token, v2UserId) {
    if (!Settings.apis || !Settings.apis.v1) {
      return {
        exists: true,
        exported: false,
      }
    }

    const v1Url = `/api/v1/overleaf/docs/${token}/info`
    const { body } = await V1Api.promises.request({ url: v1Url })
    return body
  },

  createTokenHashPrefix(token) {
    const hash = crypto.createHash('sha256')
    hash.update(token)
    return hash.digest('hex').slice(0, 6)
  },

  normalizeTokenHashPrefix(tokenHashPrefix) {
    if (typeof tokenHashPrefix !== 'string') return ''
    // remove (encoded) hash
    tokenHashPrefix = tokenHashPrefix.replace('#', '').replace('%23', '')
    // remove trailing special characters that were copied by accident
    tokenHashPrefix = tokenHashPrefix.replace(/[^a-z0-9]+$/i, '')
    return tokenHashPrefix
  },

  checkTokenHashPrefix(token, tokenHashPrefix, type, userId, logData = {}) {
    let hashPrefixStatus

    tokenHashPrefix =
      TokenAccessHandler.normalizeTokenHashPrefix(tokenHashPrefix)

    const v1Format = /%2F[0-9]{7,8}%2F/
    const isSuspectedV1Format = v1Format.test(tokenHashPrefix)

    if (!tokenHashPrefix) {
      hashPrefixStatus = 'missing'
    } else {
      const expectedHashPrefix = TokenAccessHandler.createTokenHashPrefix(token)
      if (expectedHashPrefix === tokenHashPrefix) {
        hashPrefixStatus = 'match'
      } else if (isSuspectedV1Format) {
        hashPrefixStatus = 'mismatch-v1-format'
      } else {
        hashPrefixStatus = 'mismatch'
      }
    }

    if (hashPrefixStatus === 'mismatch') {
      logger.info(
        {
          tokenHashPrefix,
          hashPrefixStatus,
          userId,
          ...logData,
          type,
        },
        'mismatched token hash prefix'
      )
    }

    Metrics.inc('link-sharing.hash-check', {
      path: type,
      status: hashPrefixStatus,
    })
  },
}

module.exports = {
  ...TokenAccessHandler,
  ...callbackifyAll(TokenAccessHandler, {
    multiResult: {
      validateTokenForAnonymousAccess: [
        'isValidReadAndWrite',
        'isValidReadOnly',
      ],
    },
    without: [
      'makeTokenUrl',
      'getTokenType',
      'isReadOnlyToken',
      'isReadAndWriteToken',
      'isValidToken',
      'tokenAccessEnabledForProject',
      'grantSessionTokenAccess',
      'getRequestToken',
      'createTokenHashPrefix',
      'normalizeTokenHashPrefix',
      'checkTokenHashPrefix',
      '_makeReadAndWriteTokenUrl',
      '_makeReadOnlyTokenUrl',
      '_projectFindOne',
      '_extractNumericPrefix',
      '_extractStringSuffix',
    ],
  }),
  promises: TokenAccessHandler,
}
