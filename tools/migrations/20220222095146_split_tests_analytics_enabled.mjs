const tags = ['saas']

const migrate = async client => {
  const { db } = client
  await db.splittests.updateMany(
    {},
    { $set: { 'versions.$[version].analyticsEnabled': true } },
    {
      arrayFilters: [
        {
          'version.active': true,
          'version.analyticsEnabled': { $exists: false },
        },
      ],
    }
  )
  await db.splittests.updateMany(
    {},
    { $set: { 'versions.$[version].analyticsEnabled': false } },
    {
      arrayFilters: [
        {
          'version.active': false,
          'version.analyticsEnabled': { $exists: false },
        },
      ],
    }
  )
}

const rollback = async client => {
  const { db } = client
  await db.splittests.updateMany(
    {},
    { $unset: { 'versions.$[version].analyticsEnabled': 1 } },
    {
      arrayFilters: [
        { 'version.active': true, 'version.analyticsEnabled': true },
      ],
    }
  )
  await db.splittests.updateMany(
    {},
    { $unset: { 'versions.$[version].analyticsEnabled': 1 } },
    {
      arrayFilters: [
        { 'version.active': false, 'version.analyticsEnabled': false },
      ],
    }
  )
}

export default {
  tags,
  migrate,
  rollback,
}
