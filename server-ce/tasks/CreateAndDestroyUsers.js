/* eslint-disable
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

module.exports = function (grunt) {
  grunt.registerTask(
    'user:create-admin',
    'Create a user with the given email address and make them an admin. Update in place if the user already exists. Usage: grunt user:create-admin --email joe@example.com',
    function () {
      const done = this.async()
      const email = grunt.option('email')
      if (email == null) {
        console.error('Usage: grunt user:create-admin --email=joe@example.com')
        process.exit(1)
      }

      const settings = require('@overleaf/settings')
      const mongodb = require('../web/app/src/infrastructure/mongodb')
      const UserRegistrationHandler = require('../web/app/src/Features/User/UserRegistrationHandler')
      const OneTimeTokenHandler = require('../web/app/src/Features/Security/OneTimeTokenHandler')
      return mongodb.waitForDb().then(() =>
        UserRegistrationHandler.registerNewUser(
          {
            email,
            password: require('crypto').randomBytes(32).toString('hex'),
          },
          function (error, user) {
            if (
              error != null &&
              (error != null ? error.message : undefined) !==
                'EmailAlreadyRegistered'
            ) {
              throw error
            }
            user.isAdmin = true
            return user.save(function (error) {
              if (error != null) {
                throw error
              }
              const ONE_WEEK = 7 * 24 * 60 * 60 // seconds
              return OneTimeTokenHandler.getNewToken(
                'password',
                {
                  expiresIn: ONE_WEEK,
                  email: user.email,
                  user_id: user._id.toString(),
                },
                function (err, token) {
                  if (err != null) {
                    return next(err)
                  }

                  console.log('')
                  console.log(`\
Successfully created ${email} as an admin user.

Please visit the following URL to set a password for ${email} and log in:

${settings.siteUrl}/user/password/set?passwordResetToken=${token}
\
`)
                  return done()
                }
              )
            })
          }
        )
      )
    }
  )

  return grunt.registerTask(
    'user:delete',
    'deletes a user and all their data, Usage: grunt user:delete --email joe@example.com',
    function () {
      const done = this.async()
      const email = grunt.option('email')
      if (email == null) {
        console.error('Usage: grunt user:delete --email=joe@example.com')
        process.exit(1)
      }
      const settings = require('@overleaf/settings')
      const mongodb = require('../web/app/src/infrastructure/mongodb')
      const UserGetter = require('../web/app/src/Features/User/UserGetter')
      const UserDeleter = require('../web/app/src/Features/User/UserDeleter')
      return mongodb.waitForDb().then(() =>
        UserGetter.getUser({ email }, function (error, user) {
          if (error != null) {
            throw error
          }
          if (user == null) {
            console.log(
              `user ${email} not in database, potentially already deleted`
            )
            return done()
          }
          return UserDeleter.deleteUser(user._id, function (err) {
            if (err != null) {
              throw err
            }
            return done()
          })
        })
      )
    }
  )
}
