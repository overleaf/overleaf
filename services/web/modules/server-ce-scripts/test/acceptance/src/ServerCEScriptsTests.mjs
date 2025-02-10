import { execSync } from 'node:child_process'
import fs from 'node:fs'
import Settings from '@overleaf/settings'
import { expect } from 'chai'
import { db } from '../../../../../app/src/infrastructure/mongodb.js'
import UserHelper from '../../../../../test/acceptance/src/helpers/User.mjs'

const { promises: User } = UserHelper

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
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      LOG_LEVEL: 'warn',
    },
  }).toString()
}

function runAndExpectError(cmd, errorMessages) {
  try {
    run(cmd)
  } catch (error) {
    expect(error.status).to.equal(1)
    if (errorMessages) {
      errorMessages.forEach(errorMessage =>
        expect(error.stderr.toString()).to.include(errorMessage)
      )
    }
    return
  }
  expect.fail('command should have failed')
}

async function getUser(email) {
  return db.users.findOne({ email }, { projection: { _id: 0, isAdmin: 1 } })
}

describe('ServerCEScripts', function () {
  describe('check-mongodb', function () {
    it('should exit with code 0 on success', function () {
      run('node modules/server-ce-scripts/scripts/check-mongodb.mjs')
    })

    it('should exit with code 1 on error', function () {
      try {
        run(
          'MONGO_SERVER_SELECTION_TIMEOUT=1' +
            'MONGO_CONNECTION_STRING=mongodb://127.0.0.1:4242 ' +
            'node modules/server-ce-scripts/scripts/check-mongodb.mjs'
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
      run('node modules/server-ce-scripts/scripts/check-redis.mjs')
    })

    it('should exit with code 1 on error', function () {
      try {
        run(
          'REDIS_PORT=42 node modules/server-ce-scripts/scripts/check-redis.mjs'
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
        'node modules/server-ce-scripts/scripts/create-user.js --email=foo@bar.com'
      )
      expect(out).to.include('/user/activate?token=')
    })

    it('should create a regular user by default', async function () {
      run(
        'node modules/server-ce-scripts/scripts/create-user.js --email=foo@bar.com'
      )
      expect(await getUser('foo@bar.com')).to.deep.equal({ isAdmin: false })
    })

    it('should create an admin user with --admin flag', async function () {
      run(
        'node modules/server-ce-scripts/scripts/create-user.js --admin --email=foo@bar.com'
      )
      expect(await getUser('foo@bar.com')).to.deep.equal({ isAdmin: true })
    })

    it('should exit with code 1 on missing email', function () {
      try {
        run('node modules/server-ce-scripts/scripts/create-user.js')
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
        'node modules/server-ce-scripts/scripts/delete-user.mjs --email=' +
          email
      )
      expect(out).to.include('not in database, potentially already deleted')
    })

    it('should exit with code 0 on success', function () {
      const email = user.email
      run(
        'node modules/server-ce-scripts/scripts/delete-user.mjs --email=' +
          email
      )
    })

    it('should have deleted the user on success', async function () {
      const email = user.email
      run(
        'node modules/server-ce-scripts/scripts/delete-user.mjs --email=' +
          email
      )
      const dbEntry = await user.get()
      expect(dbEntry).to.not.exist
      const softDeletedEntry = await db.deletedUsers.findOne({
        'user.email': email,
      })
      expect(softDeletedEntry).to.exist
      expect(softDeletedEntry.deleterData.deleterIpAddress).to.equal('0.0.0.0')
    })

    it('should exit with code 1 on missing email', function () {
      try {
        run('node modules/server-ce-scripts/scripts/delete-user.mjs')
      } catch (e) {
        expect(e.status).to.equal(1)
        return
      }
      expect.fail('command should have failed')
    })
  })

  describe('migrate-user-emails', function () {
    let usersToMigrate
    let otherUsers
    let csv
    let csvfail
    beforeEach(async function () {
      // set up some users to migrate and others to leave alone
      usersToMigrate = []
      otherUsers = []
      for (let i = 0; i < 2; i++) {
        const user = new User()
        await user.login()
        usersToMigrate.push(user)
      }
      for (let i = 0; i < 2; i++) {
        const user = new User()
        await user.login()
        otherUsers.push(user)
      }
      // write the migration csv to a temporary file
      const id = usersToMigrate[0]._id
      csv = `/tmp/migration-${id}.csv`
      const rows = []
      for (const user of usersToMigrate) {
        rows.push(`${user.email},new-${user.email}`)
      }
      fs.writeFileSync(csv, rows.join('\n'))
      // also write a csv with a user that doesn't exist
      csvfail = `/tmp/migration-fail-${id}.csv`
      fs.writeFileSync(
        csvfail,
        [
          'nouser@example.com,nouser@other.example.com',
          ...rows,
          'foo@example.com,bar@example.com',
        ].join('\n')
      )
    })

    afterEach(function () {
      // clean up the temporary files
      fs.unlinkSync(csv)
      fs.unlinkSync(csvfail)
    })

    it('should do a dry run by default', async function () {
      run(
        `node modules/server-ce-scripts/scripts/migrate-user-emails.mjs ${csv}`
      )
      for (const user of usersToMigrate) {
        const dbEntry = await user.get()
        expect(dbEntry.email).to.equal(user.email)
      }
      for (const user of otherUsers) {
        const dbEntry = await user.get()
        expect(dbEntry.email).to.equal(user.email)
      }
    })

    it('should exit with code 0 when successfully migrating user emails', function () {
      run(
        `node modules/server-ce-scripts/scripts/migrate-user-emails.mjs --commit ${csv}`
      )
    })

    it('should migrate the user emails with the --commit option', async function () {
      run(
        `node modules/server-ce-scripts/scripts/migrate-user-emails.mjs --commit ${csv}`
      )
      for (const user of usersToMigrate) {
        const dbEntry = await user.get()
        expect(dbEntry.email).to.equal(`new-${user.email}`)
        expect(dbEntry.emails).to.have.lengthOf(1)
        expect(dbEntry.emails[0].email).to.equal(`new-${user.email}`)
        expect(dbEntry.emails[0].reversedHostname).to.equal('moc.elpmaxe')
        expect(dbEntry.emails[0].createdAt).to.eql(user.emails[0].createdAt)
      }
    })

    it('should leave other user emails unchanged', async function () {
      run(
        `node modules/server-ce-scripts/scripts/migrate-user-emails.mjs --commit ${csv}`
      )
      for (const user of otherUsers) {
        const dbEntry = await user.get()
        expect(dbEntry.email).to.equal(user.email)
      }
    })

    it('should exit with code 1 when there are failures migrating user emails', function () {
      try {
        run(
          `node modules/server-ce-scripts/scripts/migrate-user-emails.mjs --commit ${csvfail}`
        )
      } catch (e) {
        expect(e.status).to.equal(1)
        return
      }
      expect.fail('command should have failed')
    })

    it('should migrate other users when there are failures with the --continue option', async function () {
      try {
        run(
          `node modules/server-ce-scripts/scripts/migrate-user-emails.mjs --commit ${csvfail}`
        )
      } catch (e) {
        expect(e.status).to.equal(1)
        run(
          `node modules/server-ce-scripts/scripts/migrate-user-emails.mjs --commit --continue ${csvfail}`
        )
        for (const user of usersToMigrate) {
          const dbEntry = await user.get()
          expect(dbEntry.email).to.equal(`new-${user.email}`)
          expect(dbEntry.emails).to.have.lengthOf(1)
          expect(dbEntry.emails[0].email).to.equal(`new-${user.email}`)
          expect(dbEntry.emails[0].reversedHostname).to.equal('moc.elpmaxe')
          expect(dbEntry.emails[0].createdAt).to.eql(user.emails[0].createdAt)
        }
        return
      }
      expect.fail('command should have failed')
    })
  })

  describe('rename-tag', function () {
    let user
    beforeEach(async function () {
      user = new User()
      await user.login()
    })

    async function createTag(name) {
      await user.doRequest('POST', { url: '/tag', json: { name } })
    }

    async function getTagNames() {
      const { body } = await user.doRequest('GET', { url: '/tag', json: true })
      return body.map(tag => tag.name)
    }

    it('should rename a tag', async function () {
      const oldName = 'before'
      const newName = 'after'
      await createTag(oldName)

      expect(await getTagNames()).to.deep.equal([oldName])

      run(
        `node modules/server-ce-scripts/scripts/rename-tag.mjs --user-id=${user.id} --old-name=${oldName} --new-name=${newName}`
      )

      expect(await getTagNames()).to.deep.equal([newName])
    })
  })

  describe('change-compile-timeout', function () {
    let userA, userB
    beforeEach('login', async function () {
      userA = new User()
      await userA.login()

      userB = new User()
      await userB.login()
    })

    async function getCompileTimeout(user) {
      const { compileTimeout } = await user.getFeatures()
      return compileTimeout
    }

    let userATimeout, userBTimeout
    beforeEach('fetch current state', async function () {
      userATimeout = await getCompileTimeout(userA)
      userBTimeout = await getCompileTimeout(userB)
    })

    describe('happy path', function () {
      let newUserATimeout
      beforeEach('run script on user a', function () {
        newUserATimeout = userATimeout - 1
        run(
          `node modules/server-ce-scripts/scripts/change-compile-timeout.mjs --user-id=${userA.id} --compile-timeout=${newUserATimeout}`
        )
      })

      it('should change the timeout for user a', async function () {
        const actual = await getCompileTimeout(userA)
        expect(actual).to.not.equal(userATimeout)
        expect(actual).to.equal(newUserATimeout)
      })

      it('should leave the timeout for user b as is', async function () {
        expect(await getCompileTimeout(userB)).to.equal(userBTimeout)
      })
    })

    describe('bad options', function () {
      it('should reject zero timeout', async function () {
        try {
          run(
            `node modules/server-ce-scripts/scripts/change-compile-timeout.mjs --user-id=${userA.id} --compile-timeout=0`
          )
          expect.fail('should error out')
        } catch (err) {
          expect(err.stderr.toString()).to.include('positive number of seconds')
        }
        expect(await getCompileTimeout(userA)).to.equal(userATimeout)
        expect(await getCompileTimeout(userB)).to.equal(userBTimeout)
      })

      it('should reject a 20min timeout', async function () {
        try {
          run(
            `node modules/server-ce-scripts/scripts/change-compile-timeout.mjs --user-id=${userA.id} --compile-timeout=1200`
          )
          expect.fail('should error out')
        } catch (err) {
          expect(err.stderr.toString()).to.include('below 10 minutes')
        }
        expect(await getCompileTimeout(userA)).to.equal(userATimeout)
        expect(await getCompileTimeout(userB)).to.equal(userBTimeout)
      })
    })
  })

  describe('upgrade-user-features', function () {
    let userLatest, userSP1, userCustomTimeoutLower, userCustomTimeoutHigher
    beforeEach('create users', async function () {
      userLatest = new User()
      userSP1 = new User()
      userCustomTimeoutLower = new User()
      userCustomTimeoutHigher = new User()

      await Promise.all([
        userLatest.ensureUserExists(),
        userSP1.ensureUserExists(),
        userCustomTimeoutLower.ensureUserExists(),
        userCustomTimeoutHigher.ensureUserExists(),
      ])
    })

    const serverPro1Features = {
      collaborators: -1,
      dropbox: true,
      versioning: true,
      compileTimeout: 180,
      compileGroup: 'standard',
      references: true,
      trackChanges: true,
    }

    beforeEach('downgrade userSP1', async function () {
      await userSP1.mongoUpdate({ $set: { features: serverPro1Features } })
    })

    beforeEach('downgrade userCustomTimeoutLower', async function () {
      run(
        `node modules/server-ce-scripts/scripts/change-compile-timeout.mjs --user-id=${userCustomTimeoutLower.id} --compile-timeout=42`
      )
    })

    beforeEach('upgrade userCustomTimeoutHigher', async function () {
      run(
        `node modules/server-ce-scripts/scripts/change-compile-timeout.mjs --user-id=${userCustomTimeoutHigher.id} --compile-timeout=360`
      )
    })

    async function getFeatures() {
      return [
        await userLatest.getFeatures(),
        await userSP1.getFeatures(),
        await userCustomTimeoutLower.getFeatures(),
        await userCustomTimeoutHigher.getFeatures(),
      ]
    }

    let initialFeatures
    beforeEach('collect initial features', async function () {
      initialFeatures = await getFeatures()
    })

    it('should have prepared the right features', async function () {
      expect(initialFeatures).to.deep.equal([
        Settings.defaultFeatures,
        serverPro1Features,
        Object.assign({}, Settings.defaultFeatures, {
          compileTimeout: 42,
        }),
        Object.assign({}, Settings.defaultFeatures, {
          compileTimeout: 360,
        }),
      ])
    })

    describe('dry-run', function () {
      let output
      beforeEach('run script', function () {
        output = run(
          `node modules/server-ce-scripts/scripts/upgrade-user-features.mjs`
        )
      })

      it('should update SP1 features', function () {
        expect(output).to.include(userSP1.id)
      })

      it('should update lowerTimeout features', function () {
        expect(output).to.include(userCustomTimeoutLower.id)
      })

      it('should not update latest features', function () {
        expect(output).to.not.include(userLatest.id)
      })

      it('should not update higherTimeout features', function () {
        expect(output).to.not.include(userCustomTimeoutHigher.id)
      })

      it('should not change any features in the db', async function () {
        expect(await getFeatures()).to.deep.equal(initialFeatures)
      })
    })

    describe('live run', function () {
      let output
      beforeEach('run script', function () {
        output = run(
          `node modules/server-ce-scripts/scripts/upgrade-user-features.mjs --dry-run=false`
        )
      })

      it('should update SP1 features', function () {
        expect(output).to.include(userSP1.id)
      })

      it('should update lowerTimeout features', function () {
        expect(output).to.include(userCustomTimeoutLower.id)
      })

      it('should not update latest features', function () {
        expect(output).to.not.include(userLatest.id)
      })

      it('should not update higherTimeout features', function () {
        expect(output).to.not.include(userCustomTimeoutHigher.id)
      })

      it('should update features in the db', async function () {
        expect(await getFeatures()).to.deep.equal([
          Settings.defaultFeatures,
          Settings.defaultFeatures,
          Settings.defaultFeatures,
          Object.assign({}, Settings.defaultFeatures, {
            compileTimeout: 360,
          }),
        ])
      })
    })
  })

  describe('check-texlive-images', function () {
    const TEST_TL_IMAGE = 'sharelatex/texlive:2023'
    const TEST_TL_IMAGE_LIST =
      'sharelatex/texlive:2021,sharelatex/texlive:2022,sharelatex/texlive:2023'

    let output

    function buildCheckTexLiveCmd({
      SANDBOXED_COMPILES,
      TEX_LIVE_DOCKER_IMAGE,
      ALL_TEX_LIVE_DOCKER_IMAGES,
      OVERLEAF_IS_SERVER_PRO = true,
    }) {
      let cmd = `SANDBOXED_COMPILES=${SANDBOXED_COMPILES ? 'true' : 'false'}`
      if (TEX_LIVE_DOCKER_IMAGE) {
        cmd += ` TEX_LIVE_DOCKER_IMAGE='${TEX_LIVE_DOCKER_IMAGE}'`
      }
      if (ALL_TEX_LIVE_DOCKER_IMAGES) {
        cmd += ` ALL_TEX_LIVE_DOCKER_IMAGES='${ALL_TEX_LIVE_DOCKER_IMAGES}'`
      }
      if (OVERLEAF_IS_SERVER_PRO === true) {
        cmd += ` OVERLEAF_IS_SERVER_PRO=${OVERLEAF_IS_SERVER_PRO}`
      }
      return (
        cmd + ' node modules/server-ce-scripts/scripts/check-texlive-images.mjs'
      )
    }

    beforeEach(async function () {
      const user = new User()
      await user.ensureUserExists()
      await user.login()
      await user.createProject('test-project')
    })

    describe('when running in CE', function () {
      beforeEach('run script', function () {
        output = run(buildCheckTexLiveCmd({ OVERLEAF_IS_SERVER_PRO: false }))
      })

      it('should skip checks', function () {
        expect(output).to.include(
          'Running Overleaf Community Edition, skipping TexLive checks'
        )
      })
    })

    describe('when sandboxed compiles are disabled', function () {
      beforeEach('run script', function () {
        output = run(buildCheckTexLiveCmd({ SANDBOXED_COMPILES: false }))
      })

      it('should skip checks', function () {
        expect(output).to.include(
          'Sandboxed compiles disabled, skipping TexLive checks'
        )
      })
    })

    describe('when texlive configuration is incorrect', function () {
      it('should fail when TEX_LIVE_DOCKER_IMAGE is not set', function () {
        runAndExpectError(
          buildCheckTexLiveCmd({
            SANDBOXED_COMPILES: true,
            ALL_TEX_LIVE_DOCKER_IMAGES: TEST_TL_IMAGE_LIST,
          }),
          [
            'Sandboxed compiles require TEX_LIVE_DOCKER_IMAGE and ALL_TEX_LIVE_DOCKER_IMAGES being set',
          ]
        )
      })

      it('should fail when ALL_TEX_LIVE_DOCKER_IMAGES is not set', function () {
        runAndExpectError(
          buildCheckTexLiveCmd({
            SANDBOXED_COMPILES: true,
            TEX_LIVE_DOCKER_IMAGE: TEST_TL_IMAGE,
          }),
          [
            'Sandboxed compiles require TEX_LIVE_DOCKER_IMAGE and ALL_TEX_LIVE_DOCKER_IMAGES being set',
          ]
        )
      })

      it('should fail when TEX_LIVE_DOCKER_IMAGE is not defined in ALL_TEX_LIVE_DOCKER_IMAGES', function () {
        runAndExpectError(
          buildCheckTexLiveCmd({
            SANDBOXED_COMPILES: true,
            TEX_LIVE_DOCKER_IMAGE: 'tl-1',
            ALL_TEX_LIVE_DOCKER_IMAGES: 'tl-2,tl-3',
          }),
          [
            'TEX_LIVE_DOCKER_IMAGE must be included in ALL_TEX_LIVE_DOCKER_IMAGES',
          ]
        )
      })
    })

    describe(`when projects don't have 'imageName' set`, function () {
      beforeEach(async function () {
        await db.projects.updateMany({}, { $unset: { imageName: 1 } })
      })

      it('should fail and suggest running backfilling scripts', function () {
        runAndExpectError(
          buildCheckTexLiveCmd({
            SANDBOXED_COMPILES: true,
            TEX_LIVE_DOCKER_IMAGE: TEST_TL_IMAGE,
            ALL_TEX_LIVE_DOCKER_IMAGES: TEST_TL_IMAGE_LIST,
          }),
          [
            `'project.imageName' is not set for some projects`,
            `Set SKIP_TEX_LIVE_CHECK=true in config/variables.env, restart the instance and run 'bin/run-script scripts/backfill_project_image_name.js' to initialise TexLive image in existing projects`,
          ]
        )
      })
    })

    describe(`when projects have a null 'imageName'`, function () {
      beforeEach(async function () {
        await db.projects.updateMany({}, { $set: { imageName: null } })
      })

      it('should fail and suggest running backfilling scripts', function () {
        runAndExpectError(
          buildCheckTexLiveCmd({
            SANDBOXED_COMPILES: true,
            TEX_LIVE_DOCKER_IMAGE: TEST_TL_IMAGE,
            ALL_TEX_LIVE_DOCKER_IMAGES: TEST_TL_IMAGE_LIST,
          }),
          [
            `'project.imageName' is not set for some projects`,
            `Set SKIP_TEX_LIVE_CHECK=true in config/variables.env, restart the instance and run 'bin/run-script scripts/backfill_project_image_name.js' to initialise TexLive image in existing projects`,
          ]
        )
      })
    })

    describe('when TexLive ALL_TEX_LIVE_DOCKER_IMAGES are upgraded and used images are no longer available', function () {
      it('should suggest running a fixing script', async function () {
        await db.projects.updateMany({}, { $set: { imageName: TEST_TL_IMAGE } })
        runAndExpectError(
          buildCheckTexLiveCmd({
            SANDBOXED_COMPILES: true,
            TEX_LIVE_DOCKER_IMAGE: 'tl-1',
            ALL_TEX_LIVE_DOCKER_IMAGES: 'tl-1,tl-2',
          }),
          [
            `Set SKIP_TEX_LIVE_CHECK=true in config/variables.env, restart the instance and run 'bin/run-script scripts/update_project_image_name.js <dangling_image> <new_image>' to update projects to a new image`,
          ]
        )
      })
    })

    describe('success scenarios', function () {
      beforeEach(async function () {
        await db.projects.updateMany({}, { $set: { imageName: TEST_TL_IMAGE } })
      })

      it('should succeed when there are no changes to the TexLive images', function () {
        const output = run(
          buildCheckTexLiveCmd({
            SANDBOXED_COMPILES: true,
            TEX_LIVE_DOCKER_IMAGE: TEST_TL_IMAGE,
            ALL_TEX_LIVE_DOCKER_IMAGES: TEST_TL_IMAGE_LIST,
          })
        )
        expect(output).to.include('Done.')
      })

      it('should succeed when there are valid changes to the TexLive images', function () {
        const output = run(
          buildCheckTexLiveCmd({
            SANDBOXED_COMPILES: true,
            TEX_LIVE_DOCKER_IMAGE: 'new-image',
            ALL_TEX_LIVE_DOCKER_IMAGES: TEST_TL_IMAGE_LIST + ',new-image',
          })
        )
        expect(output).to.include('Done.')
      })
    })
  })
})
