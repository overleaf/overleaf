/* eslint-disable no-unused-vars */

const Helpers = require('./lib/helpers')

exports.tags = ['server-ce', 'server-pro', 'saas']

exports.migrate = async client => {
  const { db } = client
  await Helpers.assertDependency(
    '20240524135408_add_token_hmac_project_invite_tokens'
  )
  await db.projectInvites.updateMany({}, { $unset: { token: 1 } })
}

exports.rollback = async client => {}
