const tags = ['server-ce', 'server-pro']

function fixEmails(user) {
  let emails = user.emails
  if (!emails || emails.length === 0) {
    emails = [{ email: user.email, createdAt: new Date() }]
  }
  for (let i = 0; i < emails.length; i++) {
    const reversedHostname = emails[i].email
      .split('@')[1]
      .split('')
      .reverse()
      .join('')
    if (emails[i].reversedHostname !== reversedHostname) {
      emails = emails.slice()
      emails[i].reversedHostname = reversedHostname
    }
  }
  return emails
}

const migrate = async client => {
  const { db } = client

  const cursor = db.users.find({}, { projection: { email: 1, emails: 1 } })
  for await (const user of cursor) {
    const emails = fixEmails(user)
    if (user.emails !== emails) {
      await db.users.updateOne({ _id: user._id }, { $set: { emails } })
    }
  }
}

const rollback = async () => {}

export default {
  tags,
  migrate,
  rollback,
}
