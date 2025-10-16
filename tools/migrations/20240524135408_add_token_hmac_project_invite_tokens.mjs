/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'
import Crypto from 'node:crypto'
import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'

const tags = ['server-ce', 'server-pro', 'saas']

// Copied from services/web/app/src/Features/Collaborators/CollaboratorsInviteHelper.js
function hashInviteToken(token) {
  return Crypto.createHmac('sha256', 'overleaf-token-invite')
    .update(token)
    .digest('hex')
}

const index = {
  key: {
    tokenHmac: 1,
  },
  name: 'tokenHmac_1',
}

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.projectInvites, [index])

  await batchedUpdate(
    db.projectInvites,
    { tokenHmac: { $exists: false } },
    async invites => {
      for (const invite of invites) {
        const tokenHmac = hashInviteToken(invite.token)

        await db.projectInvites.updateOne(
          { _id: invite._id },
          { $set: { tokenHmac } }
        )
      }
    },
    { token: 1 }
  )
}

const rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.projectInvites, [index])
}

export default {
  tags,
  migrate,
  rollback,
}
