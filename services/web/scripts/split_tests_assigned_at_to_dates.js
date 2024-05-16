const { db, waitForDb } = require('../app/src/infrastructure/mongodb')

async function updateStringDates() {
  await waitForDb()
  const users = db.users.find({
    splitTests: { $exists: true },
  })

  let user
  let count = 0
  while ((user = await users.next())) {
    count += 1
    if (count % 10000 === 0) {
      console.log(`processed ${count} users...`)
    }

    const splitTests = user.splitTests
    for (const splitTestKey of Object.keys(splitTests)) {
      for (const variantIndex in splitTests[splitTestKey]) {
        splitTests[splitTestKey][variantIndex].assignedAt = new Date(
          splitTests[splitTestKey][variantIndex].assignedAt
        )
      }
    }

    await db.users.updateOne(
      {
        _id: user._id,
      },
      { $set: { splitTests } }
    )
  }
  console.log(`Updated ${count} assignedAt strings to dates!`)
}

if (!module.parent) {
  updateStringDates()
    .then(() => {
      process.exit(0)
    })
    .catch(error => {
      console.error(error)
      process.exit(1)
    })
}

module.exports = updateStringDates
