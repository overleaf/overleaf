const tags = ['server-ce', 'server-pro', 'saas']

const migrate = async client => {
  // Skip back-filling. The deletedFiles collection will be deleted in a following migration.
  // The projects.deletedFiles array will be purged as part of the later migration as well.
}

const rollback = async client => {}

export default {
  tags,
  migrate,
  rollback,
}
