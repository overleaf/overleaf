/* eslint-disable no-unused-vars */

const tags = ['server-ce', 'server-pro', 'saas']

async function removeDuplicates(collection, field) {
  const duplicates = await collection.aggregate(
    [
      {
        $group: {
          _id: { projectId: `$deleterData.${field}` },
          dups: { $addToSet: '$_id' },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ],
    { allowDiskUse: true }
  )
  let duplicate
  while ((duplicate = await duplicates.next())) {
    // find duplicate items, ignore the most recent and delete the rest
    const items = await collection
      .find(
        { _id: { $in: duplicate.dups } },
        { projection: { _id: 1 }, sort: { 'deleterData.deletedAt': -1 } }
      )
      .toArray()
    items.pop()
    const ids = items.map(item => item._id)
    await collection.deleteMany({ _id: { $in: ids } })
  }
}

const migrate = async client => {
  const { db } = client
  await removeDuplicates(db.deletedProjects, 'deletedProjectId')
  await removeDuplicates(db.deletedUsers, 'deletedUserId')
}

const rollback = async client => {
  // can't really do anything here
}

export default {
  tags,
  migrate,
  rollback,
}
