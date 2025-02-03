const logger = require('@overleaf/logger')
const { ProjectInvite } = require('../../models/ProjectInvite')
const PrivilegeLevels = require('../Authorization/PrivilegeLevels')
const CollaboratorsInviteHelper = require('./CollaboratorsInviteHelper')

async function getAllInvites(projectId) {
  logger.debug({ projectId }, 'fetching invites for project')
  const invites = await ProjectInvite.find({ projectId })
    .select('_id email privileges')
    .exec()
  logger.debug(
    { projectId, count: invites.length },
    'found invites for project'
  )
  return invites
}

async function getEditInviteCount(projectId) {
  logger.debug({ projectId }, 'counting edit invites for project')
  const count = await ProjectInvite.countDocuments({
    projectId,
    privileges: { $ne: PrivilegeLevels.READ_ONLY },
  }).exec()
  return count
}

async function getInviteByToken(projectId, tokenString) {
  logger.debug({ projectId }, 'fetching invite by token')
  const invite = await ProjectInvite.findOne({
    projectId,
    tokenHmac: CollaboratorsInviteHelper.hashInviteToken(tokenString),
  }).exec()

  if (invite == null) {
    logger.err({ projectId }, 'no invite found')
    return null
  }

  return invite
}

module.exports = {
  promises: {
    getAllInvites,
    getEditInviteCount,
    getInviteByToken,
  },
}
