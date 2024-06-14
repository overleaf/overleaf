/* eslint-disable no-unused-vars */

const Helpers = require('./lib/helpers')
const runScript = require('../scripts/backfill_project_invites_token_hmac')

exports.tags = ['server-ce', 'server-pro', 'saas']

const index = {
  key: {
    tokenHmac: 1,
  },
  name: 'tokenHmac_1',
}

exports.migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.projectInvites, [index])
  await runScript(false)
}

exports.rollback = async client => {
  const { db } = client
  await Helpers.dropIndexesFromCollection(db.projectInvites, [index])
}
