exports.tags = ['server-ce', 'server-pro']

exports.migrate = async client => {
  const { db } = client
  const count = await db.projects.countDocuments({
    'overleaf.history.display': { $ne: true },
  })
  if (count > 0) {
    throw new Error(
      `Found ${count} projects not migrated to Full Project History`
    )
  }
}

exports.rollback = async client => {
  // Not applicable
}
