/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

const migrate = async client => {
  const { db } = client
  await Helpers.assertDependency(
    '20240524135408_add_token_hmac_project_invite_tokens'
  )
  await db.projectInvites.updateMany({}, { $unset: { token: 1 } })
}

const rollback = async client => {}

export default {
  tags,
  migrate,
  rollback,
}
