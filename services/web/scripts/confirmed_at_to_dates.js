const { db, waitForDb } = require('../app/src/infrastructure/mongodb')

async function updateStringDates() {
  await waitForDb()
  const users = await db.users.aggregate([
    { $unwind: { path: '$emails' } },
    {
      $match: { 'emails.confirmedAt': { $exists: true, $type: 'string' } },
    },
    {
      $project: {
        _id: 1,
        'emails.email': 1,
        'emails.confirmedAt': 1,
      },
    },
  ])

  let user
  let count = 0
  while ((user = await users.next())) {
    count += 1
    if (count % 10000 === 0) {
      console.log(`processed ${count} users`)
    }
    const confirmedAt = user.emails.confirmedAt
    const dateConfirmedAt = new Date(confirmedAt.replace(/ UTC$/, ''))
    await db.users.updateOne(
      {
        _id: user._id,
        'emails.email': user.emails.email,
      },
      {
        $set: {
          'emails.$.confirmedAt': dateConfirmedAt,
        },
      }
    )
  }
  console.log(`Updated ${count} confirmedAt strings to dates!`)
}

if (require.main === module) {
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
