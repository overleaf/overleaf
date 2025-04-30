import { promisify } from 'node:util'
import { exec } from 'node:child_process'
import { expect } from 'chai'
import { filterOutput } from './helpers/settings.mjs'
import { db, ObjectId } from '../../../app/src/infrastructure/mongodb.js'
import fs from 'node:fs/promises'

const CSV_FILENAME = '/tmp/emails-with-commas.csv'

async function runScript(commit) {
  const result = await promisify(exec)(
    ['node', 'scripts/remove_emails_with_commas.mjs', commit && '--commit']
      .filter(Boolean)
      .join(' ')
  )
  return {
    ...result,
    stdout: result.stdout.split('\n').filter(filterOutput),
  }
}

function createUser(email, emails) {
  return {
    _id: new ObjectId(),
    email,
    emails,
  }
}

describe('scripts/remove_emails_with_commas', function () {
  let user, unchangedUser

  beforeEach(async function () {
    await fs.writeFile(
      CSV_FILENAME,
      '"user,email@test.com"\n"user,another@test.com"\n'
    )
  })

  afterEach(async function () {
    try {
      await fs.unlink(CSV_FILENAME)
    } catch (err) {
      // Ignore errors if file doesn't exist
    }
  })

  describe('when removing email addresses with commas', function () {
    beforeEach(async function () {
      user = createUser('user,email@test.com', [
        {
          email: 'user,email@test.com',
          createdAt: new Date(),
          reversedHostname: 'moc.tset',
        },
      ])
      await db.users.insertOne(user)

      unchangedUser = createUser('john.doe@example.com', [
        {
          email: 'john.doe@example.com',
          createdAt: new Date(),
          reversedHostname: 'moc.elpmaxe',
        },
      ])
      await db.users.insertOne(unchangedUser)
    })

    afterEach(async function () {
      await db.users.deleteOne({ _id: user._id })
    })

    it('should replace emails with commas with encoded support emails', async function () {
      const r = await runScript(true)

      expect(r.stdout).to.include(
        'user,email@test.com -> support+user_2cemail_40test.com@overleaf.com'
      )
      expect(r.stdout).to.include('Updated users: 1')

      const updatedUser = await db.users.findOne({ _id: user._id })
      expect(updatedUser.email).to.equal(
        'support+user_2cemail_40test.com@overleaf.com'
      )
      expect(updatedUser.emails).to.have.length(1)
      expect(updatedUser.emails[0].email).to.equal(
        'support+user_2cemail_40test.com@overleaf.com'
      )
      expect(updatedUser.emails[0].reversedHostname).to.equal('moc.faelrevo')

      const unchanged = await db.users.findOne({ _id: unchangedUser._id })

      expect(unchanged.emails).to.have.length(1)
      expect(unchanged.email).to.equal('john.doe@example.com')
      expect(unchanged.emails[0].email).to.equal('john.doe@example.com')
    })

    it('should not modify anything in dry run mode', async function () {
      const r = await runScript(false)

      expect(r.stdout).to.include(
        'user,email@test.com -> support+user_2cemail_40test.com@overleaf.com'
      )
      expect(r.stdout).to.include(
        'Note: this was a dry-run. No changes were made.'
      )

      const updatedUser = await db.users.findOne({ _id: user._id })
      expect(updatedUser.email).to.equal('user,email@test.com')
      expect(updatedUser.emails).to.have.length(1)
      expect(updatedUser.emails[0].email).to.equal('user,email@test.com')
    })
  })

  describe('when handling multiple email replacements', function () {
    beforeEach(async function () {
      user = createUser('user,email@test.com', [
        {
          email: 'user,email@test.com',
          createdAt: new Date(),
          reversedHostname: 'moc.tset',
        },
        {
          email: 'normal@test.com',
          createdAt: new Date(),
          reversedHostname: 'moc.tset',
        },
      ])
      await db.users.insertOne(user)
    })

    afterEach(async function () {
      await db.users.deleteOne({ _id: user._id })
    })

    it('should only replace primary email with comma and keep other emails', async function () {
      const r = await runScript(true)

      expect(r.stdout).to.include(
        'user,email@test.com -> support+user_2cemail_40test.com@overleaf.com'
      )
      expect(r.stdout).to.include('Updated users: 1')

      const updatedUser = await db.users.findOne({ _id: user._id })
      expect(updatedUser.email).to.equal(
        'support+user_2cemail_40test.com@overleaf.com'
      )
      expect(updatedUser.emails).to.have.length(2)
      expect(updatedUser.emails[0].email).to.equal('normal@test.com')
      expect(updatedUser.emails[1].email).to.equal(
        'support+user_2cemail_40test.com@overleaf.com'
      )
    })
  })

  describe('when handling special characters in emails', function () {
    beforeEach(async function () {
      await fs.writeFile(
        CSV_FILENAME,
        '"user,email@test.com"\n",<user@test.com>"\n"user_special@test.co,"\n'
      )

      user = createUser('user,email@test.com', [
        {
          email: 'user,email@test.com',
          createdAt: new Date(),
          reversedHostname: 'moc.tset',
        },
      ])

      await db.users.insertOne(user)

      const user2 = createUser('user<>@test.com', [
        {
          email: 'user<>@test.com',
          createdAt: new Date(),
          reversedHostname: 'moc.tset',
        },
      ])

      await db.users.insertOne(user2)
    })

    afterEach(async function () {
      await db.users.deleteMany({
        email: {
          $in: [
            'support+user_2cemail_40test.com@overleaf.com',
            'support+user_60_62_40test.com@overleaf.com',
          ],
        },
      })
    })

    it('should correctly encode various special characters', async function () {
      const r = await runScript(true)

      expect(r.stdout).to.include(
        'user,email@test.com -> support+user_2cemail_40test.com@overleaf.com'
      )
      expect(r.stdout).to.include(
        ',<user@test.com> -> support+_2c_60user_40test.com_62@overleaf.com'
      )

      const updatedUser1 = await db.users.findOne({ _id: user._id })
      expect(updatedUser1.email).to.equal(
        'support+user_2cemail_40test.com@overleaf.com'
      )
    })
  })

  describe('when user does not exist', function () {
    beforeEach(async function () {
      await fs.writeFile(CSV_FILENAME, '"nonexistent,email@test.com"\n')
    })

    it('should handle missing users gracefully', async function () {
      const r = await runScript(true)

      expect(r.stdout).to.include(
        'User not found for email: nonexistent,email@test.com'
      )
      expect(r.stdout).to.include('Updated users: 0')
    })
  })
})
