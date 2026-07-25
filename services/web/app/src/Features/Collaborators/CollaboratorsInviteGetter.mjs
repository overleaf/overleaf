import logger from '@overleaf/logger'
import { ProjectInvite } from '../../models/ProjectInvite.mjs'
import PrivilegeLevels from '../Authorization/PrivilegeLevels.mjs'
import CollaboratorsInviteHelper from './CollaboratorsInviteHelper.mjs'

async function getAllInvites(projectId) {
  logger.debug({ projectId }, 'fetching invites for project')
  const invites = await ProjectInvite.find({
    projectId,
    reusable: { $ne: true },
  })
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
    reusable: { $ne: true },
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

async function getSharingLinkInvite(projectId) {
  logger.debug({ projectId }, 'getting sharing link invite for project')
  const invite = await ProjectInvite.findOne({
    projectId,
    reusable: true,
  }).exec()

  if (invite === null) {
    logger.debug({ projectId }, 'no sharing link invite found for project')
  } else {
    logger.debug({ projectId }, 'found sharing link invite for project')
  }
  return invite
}

export default {
  promises: {
    getAllInvites,
    getEditInviteCount,
    getInviteByToken,
    getSharingLinkInvite,
  },
}
