import { promisify } from 'node:util'
import { exec } from 'node:child_process'
import { expect } from 'chai'
import { filterOutput } from './helpers/settings.mjs'
import { db, ObjectId } from '../../../app/src/infrastructure/mongodb.js'
import fs from 'node:fs/promises'

const CSV_FILENAME = '/tmp/remove_unconfirmed_emails.csv'

async function runScript(mode, commit) {
  const result = await promisify(exec)(
    [
      'node',
      'scripts/remove_unconfirmed_emails.mjs',
      mode === 'generate' ? '--generate' : '--consume',
      commit && '--commit',
    ]
      .filter(Boolean)
      .join(' ')
  )
  return {
    ...result,
    stdout: result.stdout.split('\n').filter(filterOutput),
  }
}

function createUser(signUpDate, emails, userIdx) {
  const email = `primary${userIdx ?? ''}@overleaf.com`
  return {
    _id: new ObjectId(),
    email,
    emails,
    signUpDate,
  }
}

describe('scripts/remove_unconfirmed_emails', function () {
  let user

  afterEach(async function () {
    try {
      await fs.unlink(CSV_FILENAME)
    } catch (err) {
      // Ignore errors if file doesn't exist
    }
  })

  describe('when removing unconfirmed secondary emails', function () {
    beforeEach(async function () {
      user = createUser(new Date('2000-01-01'), [
        { email: 'primary@overleaf.com', confirmedAt: new Date() },
        { email: 'unconfirmed1@overleaf.com' },
        { email: 'unconfirmed-special-,\'"@overleaf.com' },
      ])
      await db.users.insertOne(user)
    })

    it('should remove all unconfirmed secondary emails', async function () {
      await runScript('generate')
      const r = await runScript('consume', true)

      expect(r.stdout).to.include('Total emails in the CSV: 2')
      expect(r.stdout).to.include('Total users processed: 1')

      const updatedUser = await db.users.findOne({ _id: user._id })
      expect(updatedUser.emails).to.have.length(1)
      expect(updatedUser.emails[0].email).to.equal(user.email)
    })

    it('should not modify anything in dry run mode', async function () {
      await runScript('generate')
      const r = await runScript('consume', false)

      expect(r.stdout).to.include('Total emails in the CSV: 2')
      expect(r.stdout).to.include('Total users processed: 1')
      expect(r.stdout).to.include(
        'Note: this was a dry-run. No changes were made.'
      )

      const updatedUser = await db.users.findOne({ _id: user._id })
      expect(updatedUser.emails).to.have.length(3)
    })
  })

  describe('when handling confirmed secondary emails', function () {
    beforeEach(async function () {
      user = createUser(new Date('2000-01-01'), [
        { email: 'primary@overleaf.com', confirmedAt: new Date() },
        { email: 'confirmed@overleaf.com', confirmedAt: new Date() },
      ])
      await db.users.insertOne(user)
    })

    it('should preserve confirmed secondary emails', async function () {
      await runScript('generate')
      const r = await runScript('consume', true)

      expect(r.stdout).to.include('Total emails in the CSV: 0')
      expect(r.stdout).to.include('Total users processed: 0')

      const updatedUser = await db.users.findOne({ _id: user._id })
      expect(updatedUser.emails).to.have.length(2)
      expect(updatedUser.emails[1].confirmedAt).to.exist
    })
  })

  describe('when handling unconfirmed primary emails', function () {
    beforeEach(async function () {
      user = createUser(new Date('2000-01-01'), [
        { email: 'primary@overleaf.com' },
      ])
      await db.users.insertOne(user)
    })

    it('should not remove unconfirmed primary emails', async function () {
      await runScript('generate')
      const r = await runScript('consume', true)

      expect(r.stdout).to.include('Total emails in the CSV: 0')
      expect(r.stdout).to.include('Total users processed: 0')

      const updatedUser = await db.users.findOne({ _id: user._id })
      expect(updatedUser.emails).to.have.length(1)
      expect(updatedUser.emails[0].email).to.equal('primary@overleaf.com')
    })
  })

  describe('when users confirmed their email in between', function () {
    beforeEach(async function () {
      user = createUser(new Date('2000-01-01'), [
        { email: 'primary@overleaf.com' },
        { email: 'secondary@overleaf.com' },
      ])
      await db.users.insertOne(user)
    })

    it('should not remove emails from users who confirmed their email in between', async function () {
      await runScript('generate')

      await db.users.updateOne(
        { _id: user._id },
        { $set: { 'emails.1.confirmedAt': new Date() } }
      )

      const r = await runScript('consume', true)

      expect(r.stdout).to.include('Total emails in the CSV: 1')
      expect(r.stdout).to.include('Skipped emails: 1')
      expect(r.stdout).to.include('  - Email now confirmed: 1')

      const updatedUser = await db.users.findOne({ _id: user._id })
      expect(updatedUser.emails).to.have.length(2)
    })
  })

  describe('when users changed their primary email in between', function () {
    beforeEach(async function () {
      user = createUser(new Date('2000-01-01'), [
        { email: 'primary@overleaf.com' },
        { email: 'secondary@overleaf.com' },
      ])
      await db.users.insertOne(user)
    })

    it('should not remove emails from users who changed their primary email in between', async function () {
      await runScript('generate')

      await db.users.updateOne(
        { _id: user._id },
        { $set: { email: 'secondary@overleaf.com' } }
      )
      const r = await runScript('consume', true)

      expect(r.stdout).to.include('Total emails in the CSV: 1')
      expect(r.stdout).to.include('Skipped emails: 1')
      expect(r.stdout).to.include('  - Email now primary: 1')

      const updatedUser = await db.users.findOne({ _id: user._id })
      expect(updatedUser.emails).to.have.length(2)
    })
  })

  describe('when users account was deleted in between', function () {
    beforeEach(async function () {
      user = createUser(new Date('2000-01-01'), [
        { email: 'primary@overleaf.com' },
        { email: 'secondary@overleaf.com' },
      ])
      await db.users.insertOne(user)
    })

    it('should skip emails from users whose account was deleted', async function () {
      await runScript('generate')

      // Delete the user
      await db.users.deleteOne({ _id: user._id })

      const r = await runScript('consume', true)

      expect(r.stdout).to.include('Total emails in the CSV: 1')
      expect(r.stdout).to.include('Skipped emails: 1')
      expect(r.stdout).to.include('  - User not found: 1')
    })
  })

  describe('when users email was deleted in between', function () {
    beforeEach(async function () {
      user = createUser(new Date('2000-01-01'), [
        { email: 'primary@overleaf.com' },
        { email: 'secondary@overleaf.com' },
      ])
      await db.users.insertOne(user)
    })

    it('should skip emails that were already removed', async function () {
      await runScript('generate')

      // Remove the secondary email
      await db.users.updateOne(
        { _id: user._id },
        { $pull: { emails: { email: 'secondary@overleaf.com' } } }
      )

      const r = await runScript('consume', true)

      expect(r.stdout).to.include('Total emails in the CSV: 1')
      expect(r.stdout).to.include('Skipped emails: 1')
      expect(r.stdout).to.include('  - Email now removed: 1')

      const updatedUser = await db.users.findOne({ _id: user._id })
      expect(updatedUser.emails).to.have.length(1)
      expect(updatedUser.emails[0].email).to.equal('primary@overleaf.com')
    })
  })

  describe('when handling confirmation field edge cases', function () {
    beforeEach(async function () {
      user = createUser(new Date('2000-01-01'), [
        { email: 'primary@overleaf.com', confirmedAt: new Date() },
        { email: 'secondary1@overleaf.com', confirmedAt: null },
        { email: 'secondary2@overleaf.com' },
      ])
      await db.users.insertOne(user)
    })

    it('should remove emails with both missing and null confirmedAt', async function () {
      await runScript('generate')
      const r = await runScript('consume', true)

      expect(r.stdout).to.include('Total emails in the CSV: 2')
      expect(r.stdout).to.include('Total users processed: 1')

      const updatedUser = await db.users.findOne({ _id: user._id })
      expect(updatedUser.emails).to.have.length(1)
      expect(updatedUser.emails[0].email).to.equal(user.email)
    })
  })

  describe('CSV file generation', function () {
    beforeEach(async function () {
      user = createUser(new Date('2000-01-01'), [
        { email: 'primary@overleaf.com', confirmedAt: new Date() },
        { email: 'unconfirmed1@overleaf.com' },
        { email: 'confirmed1@overleaf.com', confirmedAt: new Date() },
        { email: 'unconfirmed2@overleaf.com' },
        { email: '!,@overleaf.com' },
        { email: "!'@overleaf.com" },
        { email: '!,\'"@overleaf.com' },
      ])
      await db.users.insertOne(user)
    })

    it('should generate a valid CSV file', async function () {
      const r = await runScript('generate')

      expect(r.stdout).to.include(
        'Generated CSV file: /tmp/remove_unconfirmed_emails.csv'
      )
      expect(r.stdout).to.include('Total emails in the CSV: 5')
      const csvContent = await fs.readFile(CSV_FILENAME, 'utf8')
      expect(csvContent).to.equal(`User ID,Email,Sign Up Date
${user._id},unconfirmed1@overleaf.com,2000-01-01T00:00:00.000Z
${user._id},unconfirmed2@overleaf.com,2000-01-01T00:00:00.000Z
${user._id},"!,@overleaf.com",2000-01-01T00:00:00.000Z
${user._id},!'@overleaf.com,2000-01-01T00:00:00.000Z
${user._id},"!,'""@overleaf.com",2000-01-01T00:00:00.000Z
`)
    })
  })
})
