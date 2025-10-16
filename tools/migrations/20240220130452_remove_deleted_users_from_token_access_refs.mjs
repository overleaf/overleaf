import fixProjectsWithInvalidTokenAccessRefsIds from './scripts/remove_deleted_users_from_token_access_refs.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

const migrate = async () => {
  await fixProjectsWithInvalidTokenAccessRefsIds()
}

const rollback = async () => {}

export default {
  tags,
  migrate,
  rollback,
}
