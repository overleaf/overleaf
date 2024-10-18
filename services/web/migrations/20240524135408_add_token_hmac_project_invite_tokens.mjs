/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'
import runScript from '../scripts/backfill_project_invites_token_hmac.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

const index = {
  key: {
    tokenHmac: 1,
  },
  name: 'tokenHmac_1',
}

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.projectInvites, [index])
  await runScript(false)
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
