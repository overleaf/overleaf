import { promisify } from 'node:util'
import { exec } from 'node:child_process'
import { expect } from 'chai'
import { filterOutput } from './helpers/settings.mjs'
import { db, ObjectId } from '../../../app/src/infrastructure/mongodb.js'
import fs from 'node:fs/promises'

const CSV_FILENAME = '/tmp/re_add_deleted_emails.csv'

async function runScript(commit) {
  const result = await promisify(exec)(
    ['node', 'scripts/re_add_deleted_emails.mjs', commit && '--commit']
      .filter(Boolean)
      .join(' ')
  )

  return {
    ...result,
    stdout: result.stdout.split('\n').filter(filterOutput),
  }
}

/**
 * @param {[string, string[]][]} userEmails
 */
const createUsers = async userEmails =>
  Promise.all(
    userEmails.map(async ([email, emails]) => {
      const _id = new ObjectId()
      await db.users.insertOne({
        _id,
        email,
        emails: emails.map(email => ({ email })),
        features: {},
      })
      return _id
    })
  )

async function generateCsv(users) {
  const text = 'User ID,Email'
  const userRows = users.map(user => {
    return `${user._id.toString()},${user.email}`
  })
  await fs.writeFile(CSV_FILENAME, [text, ...userRows].join('\n'))
}

describe('scripts/re_add_deleted_emails', function () {
  let userIds

  afterEach(async function () {
    try {
      await fs.unlink(CSV_FILENAME)
    } catch (err) {
      // Ignore errors if file doesn't exist
    }
  })

  describe('when user IDs dont match', function () {
    beforeEach(async function () {
      userIds = await createUsers([['mismatch1@xmpl.com', []]])
      await generateCsv([{ _id: new ObjectId(), email: 'mismatch2@xmpl.com' }])
    })

    it('doesnt add new emails', async function () {
      const { stdout } = await runScript(true)
      expect(stdout).to.include('Total emails in the CSV: 1')
      expect(stdout).to.include('Total users in the CSV: 1')
      expect(stdout).to.include('Users not found: 1')
      expect(stdout).to.include('Added emails: 0')
      const updatedUser = await db.users.findOne({ _id: userIds[0] })
      expect(updatedUser.emails).to.have.length(0)
    })
  })

  describe('when email address is invalid', function () {
    beforeEach(async function () {
      userIds = await createUsers([['user@xmpl.com', []]])
      await generateCsv([{ _id: userIds[0], email: 'inv@lid@xmpl.com' }])
    })

    it('throws', async function () {
      await expect(runScript(true)).to.eventually.be.rejectedWith(
        'invalid email'
      )
      const updatedUser = await db.users.findOne({ _id: userIds[0] })
      expect(updatedUser.emails).to.have.length(0)
    })
    it('throws even without --commit', async function () {
      await expect(runScript(false)).to.eventually.be.rejectedWith(
        'invalid email'
      )
      const updatedUser = await db.users.findOne({ _id: userIds[0] })
      expect(updatedUser.emails).to.have.length(0)
    })
  })

  describe('when new email is used by another user', function () {
    beforeEach(async function () {
      userIds = await createUsers([
        ['user1@xmpl.com', []],
        ['user2@xmpl.com', ['new-email@xmpl.com']],
      ])
      await generateCsv([{ _id: userIds[0], email: 'new-email@xmpl.com' }])
    })

    it('doesnt add new emails', async function () {
      const { stdout } = await runScript(true)
      expect(stdout).to.include('Total emails in the CSV: 1')
      expect(stdout).to.include('Total users in the CSV: 1')
      expect(stdout).to.include('Users not found: 0')
      expect(stdout).to.include('Already in use: ["new-email@xmpl.com"]')
      expect(stdout).to.include('Added emails: 0')
      const updatedUser = await db.users.findOne({ _id: userIds[0] })
      expect(updatedUser.emails).to.have.length(0)
    })
  })

  describe('when the user has 0 email in the array', function () {
    beforeEach(async function () {
      userIds = await createUsers([['user@xmpl.com', []]])
    })

    it('adds the primary email to the user', async function () {
      await generateCsv([{ _id: userIds[0], email: 'user@xmpl.com' }])
      const { stdout } = await runScript(true)
      expect(stdout).to.include('Total emails in the CSV: 1')
      expect(stdout).to.include('Total users in the CSV: 1')
      expect(stdout).to.include('Users not found: 0')
      expect(stdout).to.include('Added emails: 1')
      const updatedUser = await db.users.findOne({ _id: userIds[0] })
      expect(updatedUser.emails).to.have.length(1)
      expect(updatedUser.emails[0].email).to.equal('user@xmpl.com')
      expect(updatedUser.emails[0].reversedHostname).to.equal('moc.lpmx')
      expect(updatedUser.emails[0].confirmedAt).to.be.an.instanceof(Date)
      expect(updatedUser.emails[0].createdAt).to.be.an.instanceof(Date)
      expect(updatedUser.emails[0].reconfirmedAt).to.be.an.instanceof(Date)
      const auditLogs = await db.userAuditLogEntries
        .find({ userId: userIds[0] })
        .toArray()
      expect(auditLogs).to.have.length(1)
      expect(auditLogs[0].operation).to.equal('add-email')
      expect(auditLogs[0].info).to.deep.include({
        script: true,
        note: 'fix wrongly removed unconfirmed secondary email',
        newSecondaryEmail: 'user@xmpl.com',
      })
    })

    it('adds the secondary email to the user', async function () {
      await generateCsv([{ _id: userIds[0], email: 'new-email@xmpl.com' }])
      const { stdout } = await runScript(true)
      expect(stdout).to.include('Total emails in the CSV: 1')
      expect(stdout).to.include('Total users in the CSV: 1')
      expect(stdout).to.include('Users not found: 0')
      expect(stdout).to.include('Added emails: 1')
      const updatedUser = await db.users.findOne({ _id: userIds[0] })
      expect(updatedUser.emails).to.have.length(1)
      expect(updatedUser.emails[0].email).to.equal('new-email@xmpl.com')
      expect(updatedUser.emails[0].reversedHostname).to.equal('moc.lpmx')
      expect(updatedUser.emails[0].confirmedAt).to.be.an.instanceof(Date)
      expect(updatedUser.emails[0].createdAt).to.be.an.instanceof(Date)
      expect(updatedUser.emails[0].reconfirmedAt).to.be.an.instanceof(Date)
      const auditLogs = await db.userAuditLogEntries
        .find({ userId: userIds[0] })
        .toArray()
      expect(auditLogs).to.have.length(1)
      expect(auditLogs[0].operation).to.equal('add-email')
      expect(auditLogs[0].info).to.deep.include({
        script: true,
        note: 'fix wrongly removed unconfirmed secondary email',
        newSecondaryEmail: 'new-email@xmpl.com',
      })
    })

    it('doesnt add new emails without --commit', async function () {
      await generateCsv([{ _id: userIds[0], email: 'new-email@xmpl.com' }])
      const { stdout } = await runScript(false)
      expect(stdout).to.include('Dry-run, use --commit to apply changes')
      const updatedUser = await db.users.findOne({ _id: userIds[0] })
      expect(updatedUser.emails).to.have.length(0)
    })
  })
  describe('when the user has several emails in the array', function () {
    beforeEach(async function () {
      userIds = await createUsers([
        [
          'user@xmpl.com',
          ['email1@xmpl.com', 'email2@xmpl.com', 'email3@xmpl.com'],
        ],
      ])
      await generateCsv([{ _id: userIds[0], email: 'new-email@xmpl.com' }])
    })

    it('adds the email to the user', async function () {
      const { stdout } = await runScript(true)

      expect(stdout).to.include('Total emails in the CSV: 1')
      expect(stdout).to.include('Total users in the CSV: 1')
      expect(stdout).to.include('Users not found: 0')
      expect(stdout).to.include('Added emails: 1')
      const updatedUser = await db.users.findOne({ _id: userIds[0] })
      expect(updatedUser.emails).to.have.length(4)

      expect(updatedUser.emails[3].email).to.equal('new-email@xmpl.com')
      expect(updatedUser.emails[3].reversedHostname).to.equal('moc.lpmx')
      expect(updatedUser.emails[3].confirmedAt).to.be.an.instanceof(Date)
      expect(updatedUser.emails[3].createdAt).to.be.an.instanceof(Date)
      expect(updatedUser.emails[3].reconfirmedAt).to.be.an.instanceof(Date)
    })

    it('doesnt add new emails without --commit', async function () {
      const { stdout } = await runScript(false)
      expect(stdout).to.include('Dry-run, use --commit to apply changes')
      const updatedUser = await db.users.findOne({ _id: userIds[0] })
      expect(updatedUser.emails).to.have.length(3)
    })
  })

  describe('all of the above', function () {
    beforeEach(async function () {
      userIds = await createUsers([
        ['user0@xmpl.com', []],
        ['user1@xmpl.com', []],
        ['user2@xmpl.com', ['a@xmpl.com', 'b@xmpl.com', 'c@xmpl.com']],
        ['user3@xmpl.com', ['d@xmpl.com', 'e@xmpl.com', 'f@xmpl.com']],
        ['user4@xmpl.com', ['x@xmpl.com', 'y@xmpl.com', 'z@xmpl.com']],
        ['user5@xmpl.com', ['u@xmpl.com', 'v@xmpl.com', 'w@xmpl.com']],
      ])
      await generateCsv([
        { _id: userIds[1], email: 'new1@xmpl.com' },
        { _id: userIds[1], email: 'user1@xmpl.com' },
        { _id: userIds[1], email: 'new2@xmpl.com' },
        { _id: userIds[2], email: 'new3@xmpl.com' },
        { _id: userIds[2], email: 'new4@xmpl.com' },
        { _id: userIds[2], email: 'user2@xmpl.com' },
        { _id: userIds[2], email: 'user3@xmpl.com' },
        { _id: userIds[3], email: 'd@xmpl.com' },
        { _id: userIds[5], email: 'a@xmpl.com' },
        { _id: new ObjectId(), email: 'a@xmpl.com' },
      ])
    })

    it('updates users', async function () {
      const { stdout } = await runScript(true)
      expect(stdout).to.include('Total emails in the CSV: 10')
      expect(stdout).to.include('Total users in the CSV: 5')
      expect(stdout).to.include('Users not found: 1')
      expect(stdout).to.include(
        'Already in use: ["user3@xmpl.com","a@xmpl.com"]'
      )
      expect(stdout).to.include('Already OK: ["d@xmpl.com"]')
      expect(stdout).to.include('Primary: ["user1@xmpl.com","user2@xmpl.com"]')
      expect(stdout).to.include(
        'Secondary: ["new1@xmpl.com","new2@xmpl.com","new3@xmpl.com","new4@xmpl.com"]'
      )
      expect(stdout).to.include(
        'Added emails: ["new1@xmpl.com","user1@xmpl.com","new2@xmpl.com","new3@xmpl.com","new4@xmpl.com","user2@xmpl.com"]'
      )

      const user0 = await db.users.findOne({ _id: userIds[0] })
      const user1 = await db.users.findOne({ _id: userIds[1] })
      const user2 = await db.users.findOne({ _id: userIds[2] })
      const user3 = await db.users.findOne({ _id: userIds[3] })
      const user4 = await db.users.findOne({ _id: userIds[4] })
      const user5 = await db.users.findOne({ _id: userIds[5] })
      expect(user0.emails).to.have.length(0)
      expect(user1.emails).to.have.length(3) // new1, user1, new2
      expect(user2.emails).to.have.length(6) // a, b, c, new3, new4, user2
      expect(user3.emails).to.have.length(3) // d, e, f
      expect(user4.emails).to.have.length(3) // x, y, z
      expect(user5.emails).to.have.length(3) // u, v, w
    })
  })
})
