const tags = ['server-ce', 'server-pro']

const migrate = async client => {
  const { db } = client

  const adminsWithEmails = await db.users
    .find(
      {
        isAdmin: true,
        emails: { $exists: true },
      },
      { _id: 1, emails: 1 }
    )
    .toArray()

  for (const { _id, emails } of adminsWithEmails) {
    let shouldUpdateEmails = false
    for (const emailObj of emails) {
      if (!emailObj.reversedHostname) {
        shouldUpdateEmails = true
        emailObj.reversedHostname = emailObj.email
          .split('@')[1]
          .split('')
          .reverse()
          .join('')
      }
    }
    if (shouldUpdateEmails) {
      await db.users.updateOne({ _id }, { $set: { emails } })
    }
  }

  const adminsNoEmails = await db.users
    .find(
      {
        isAdmin: true,
        emails: { $exists: false },
      },
      { _id: 1, email: 1 }
    )
    .toArray()

  for (const { _id, email } of adminsNoEmails) {
    const reversedHostname = email.split('@')[1].split('').reverse().join('')
    await db.users.updateOne(
      { _id },
      {
        emails: [
          {
            email,
            reversedHostname,
            createdAt: new Date(),
          },
        ],
      }
    )
  }
}

const rollback = async () => {}

export default {
  tags,
  migrate,
  rollback,
}
