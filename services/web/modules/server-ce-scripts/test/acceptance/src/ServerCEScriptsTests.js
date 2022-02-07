const { execSync } = require('child_process')
const { expect } = require('chai')
const { db } = require('../../../../../app/src/infrastructure/mongodb')
const User = require('../../../../../test/acceptance/src/helpers/User').promises

/**
 * @param {string} cmd
 * @return {string}
 */
function run(cmd) {
  // https://nodejs.org/docs/latest-v12.x/api/child_process.html#child_process_child_process_execsync_command_options
  // > stderr by default will be output to the parent process' stderr
  // > unless stdio is specified.
  // https://nodejs.org/docs/latest-v12.x/api/child_process.html#child_process_options_stdio
  // Pipe stdin from /dev/null, store stdout, pipe stderr to /dev/null.
  return execSync(cmd, {
    stdio: ['ignore', 'pipe', 'ignore'],
  }).toString()
}

async function getUser(email) {
  return db.users.findOne({ email }, { projection: { _id: 0, isAdmin: 1 } })
}

describe('ServerCEScripts', function () {
  describe('check-mongodb', function () {
    it('should exit with code 0 on success', function () {
      run('node modules/server-ce-scripts/scripts/check-mongodb')
    })

    it('should exit with code 1 on error', function () {
      try {
        run(
          'MONGO_SERVER_SELECTION_TIMEOUT=1' +
            'MONGO_CONNECTION_STRING=mongodb://localhost:4242 ' +
            'node modules/server-ce-scripts/scripts/check-mongodb'
        )
      } catch (e) {
        expect(e.status).to.equal(1)
        return
      }
      expect.fail('command should have failed')
    })
  })

  describe('check-redis', function () {
    it('should exit with code 0 on success', function () {
      run('node modules/server-ce-scripts/scripts/check-redis')
    })

    it('should exit with code 1 on error', function () {
      try {
        run(
          'REDIS_HOST=localhost node modules/server-ce-scripts/scripts/check-redis'
        )
      } catch (e) {
        expect(e.status).to.equal(1)
        return
      }
      expect.fail('command should have failed')
    })
  })

  describe('create-user', function () {
    it('should exit with code 0 on success', function () {
      const out = run(
        'node modules/server-ce-scripts/scripts/create-user --email=foo@bar.com'
      )
      expect(out).to.include('/user/activate?token=')
    })

    it('should create a regular user by default', async function () {
      run(
        'node modules/server-ce-scripts/scripts/create-user --email=foo@bar.com'
      )
      expect(await getUser('foo@bar.com')).to.deep.equal({ isAdmin: false })
    })

    it('should create an admin user with --admin flag', async function () {
      run(
        'node modules/server-ce-scripts/scripts/create-user --admin --email=foo@bar.com'
      )
      expect(await getUser('foo@bar.com')).to.deep.equal({ isAdmin: true })
    })

    it('should exit with code 1 on missing email', function () {
      try {
        run('node modules/server-ce-scripts/scripts/create-user')
      } catch (e) {
        expect(e.status).to.equal(1)
        return
      }
      expect.fail('command should have failed')
    })
  })

  describe('delete-user', function () {
    let user
    beforeEach(async function () {
      user = new User()
      await user.login()
    })

    it('should log missing user', function () {
      const email = 'does-not-exist@example.com'
      const out = run(
        'node modules/server-ce-scripts/scripts/delete-user --email=' + email
      )
      expect(out).to.include('not in database, potentially already deleted')
    })

    it('should exit with code 0 on success', function () {
      const email = user.email
      run('node modules/server-ce-scripts/scripts/delete-user --email=' + email)
    })

    it('should have deleted the user on success', async function () {
      const email = user.email
      run('node modules/server-ce-scripts/scripts/delete-user --email=' + email)
      const dbEntry = await user.get()
      expect(dbEntry).to.not.exist
    })

    it('should exit with code 1 on missing email', function () {
      try {
        run('node modules/server-ce-scripts/scripts/delete-user')
      } catch (e) {
        expect(e.status).to.equal(1)
        return
      }
      expect.fail('command should have failed')
    })
  })
})
