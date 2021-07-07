/* eslint-disable
    camelcase,
    no-return-assign,
    no-unreachable,
    no-unused-vars,
    node/handle-callback-err,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__, or convert again using --optional-chaining
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const coffee = require('coffee-script')
const fs = require('fs')
const { spawn } = require('child_process')
const { exec } = require('child_process')
const rimraf = require('rimraf')
const Path = require('path')
const semver = require('semver')
const knox = require('knox')
const crypto = require('crypto')
const async = require('async')
const settings = require('settings-sharelatex')
const _ = require('underscore')

const SERVICES = require('./config/services')

module.exports = function (grunt) {
  let Helpers
  let service
  grunt.loadNpmTasks('grunt-bunyan')
  grunt.loadNpmTasks('grunt-execute')
  grunt.loadNpmTasks('grunt-available-tasks')
  grunt.loadNpmTasks('grunt-concurrent')
  grunt.loadNpmTasks('grunt-contrib-coffee')
  grunt.loadNpmTasks('grunt-shell')

  grunt.task.loadTasks('./tasks')

  const execute = {}
  for (service of Array.from(SERVICES)) {
    execute[service.name] = { src: `${service.name}/app.js` }
  }

  grunt.initConfig({
    execute,

    concurrent: {
      all: {
        tasks: (() => {
          const result = []
          for (service of Array.from(SERVICES)) {
            result.push(`run:${service.name}`)
          }
          return result
        })(),
        options: {
          limit: SERVICES.length,
          logConcurrentOutput: true,
        },
      },
    },

    availabletasks: {
      tasks: {
        options: {
          filter: 'exclude',
          tasks: ['concurrent', 'execute', 'bunyan', 'availabletasks'],
          groups: {
            'Run tasks': ['run', 'run:all', 'default'].concat(
              (() => {
                const result1 = []
                for (service of Array.from(SERVICES)) {
                  result1.push(`run:${service.name}`)
                }
                return result1
              })()
            ),
            Misc: ['help'],
            'Install tasks': (() => {
              const result2 = []
              for (service of Array.from(SERVICES)) {
                result2.push(`install:${service.name}`)
              }
              return result2
            })().concat(['install:all', 'install']),
            'Update tasks': (() => {
              const result3 = []
              for (service of Array.from(SERVICES)) {
                result3.push(`update:${service.name}`)
              }
              return result3
            })().concat(['update:all', 'update']),
            Checks: [
              'check',
              'check:redis',
              'check:latexmk',
              'check:s3',
              'check:make',
              'check:mongo',
            ],
          },
        },
      },
    },
  })

  for (service of Array.from(SERVICES)) {
    ;(service =>
      grunt.registerTask(
        `install:${service.name}`,
        `Download and set up the ${service.name} service`,
        function () {
          const done = this.async()
          return Helpers.installService(service, done)
        }
      ))(service)
  }

  grunt.registerTask(
    'install:all',
    'Download and set up all ShareLaTeX services',
    []
      .concat(
        (() => {
          const result4 = []
          for (service of Array.from(SERVICES)) {
            result4.push(`install:${service.name}`)
          }
          return result4
        })()
      )
      .concat(['postinstall'])
  )

  grunt.registerTask('install', 'install:all')
  grunt.registerTask('postinstall', 'Explain postinstall steps', function () {
    return Helpers.postinstallMessage(this.async())
  })

  grunt.registerTask(
    'update:all',
    'Checkout and update all ShareLaTeX services',
    ['check:make'].concat(
      (() => {
        const result5 = []
        for (service of Array.from(SERVICES)) {
          result5.push(`update:${service.name}`)
        }
        return result5
      })()
    )
  )
  grunt.registerTask('update', 'update:all')
  grunt.registerTask('run', 'Run all of the sharelatex processes', [
    'concurrent:all',
  ])
  grunt.registerTask('run:all', 'run')

  grunt.registerTask('help', 'Display this help list', 'availabletasks')
  grunt.registerTask('default', 'run')

  grunt.registerTask(
    'check:redis',
    'Check that redis is installed and running',
    function () {
      return Helpers.checkRedisConnect(this.async())
    }
  )

  grunt.registerTask(
    'check:mongo',
    'Check that mongo is installed',
    function () {
      return Helpers.checkMongoConnect(this.async())
    }
  )

  grunt.registerTask(
    'check',
    'Check that you have the required dependencies installed',
    ['check:redis', 'check:mongo', 'check:make']
  )

  grunt.registerTask('check:make', 'Check that make is installed', function () {
    return Helpers.checkMake(this.async())
  })

  return (Helpers = {
    installService(service, callback) {
      if (callback == null) {
        callback = function (error) {}
      }
      console.log(`Installing ${service.name}`)
      return Helpers.cloneGitRepo(service, function (error) {
        if (error != null) {
          return callback(error)
        } else {
          return callback()
        }
      })
    },

    cloneGitRepo(service, callback) {
      if (callback == null) {
        callback = function (error) {}
      }
      const repo_src = service.repo
      const dir = service.name
      if (!fs.existsSync(dir)) {
        const proc = spawn('git', ['clone', repo_src, dir], {
          stdio: 'inherit',
        })
        return proc.on('close', () =>
          Helpers.checkoutVersion(service, callback)
        )
      } else {
        console.log(`${dir} already installed, skipping.`)
        return callback()
      }
    },

    checkoutVersion(service, callback) {
      if (callback == null) {
        callback = function (error) {}
      }
      const dir = service.name
      grunt.log.write(`checking out ${service.name} ${service.version}`)
      const proc = spawn('git', ['checkout', service.version], {
        stdio: 'inherit',
        cwd: dir,
      })
      return proc.on('close', () => callback())
    },

    postinstallMessage(callback) {
      if (callback == null) {
        callback = function (error) {}
      }
      grunt.log.write(`\
Services cloned:
	${(() => {
    const result6 = []
    for (service of Array.from(SERVICES)) {
      result6.push(service.name)
    }
    return result6
  })()}
To install services run:
	$ source bin/install-services
This will install the required node versions and run \`npm install\` for each service.
See https://github.com/sharelatex/sharelatex/pull/549 for more info.\
`)
      return callback()
    },

    checkMake(callback) {
      if (callback == null) {
        callback = function (error) {}
      }
      grunt.log.write('Checking make is installed... ')
      return exec('make --version', function (error, stdout, stderr) {
        if (error != null && error.message.match('not found')) {
          grunt.log.error('FAIL.')
          grunt.log.errorlns(`\
Either make is not installed or is not in your path.

On Ubuntu you can install make with:

    sudo apt-get install build-essential
\
`)
          return callback(error)
        } else if (error != null) {
          return callback(error)
        } else {
          grunt.log.write('OK.')
          return callback()
        }
      })
    },
    checkMongoConnect(callback) {
      if (callback == null) {
        callback = function (error) {}
      }
      grunt.log.write('Checking can connect to mongo')
      const mongojs = require('mongojs')
      const db = mongojs(settings.mongo.url, ['tags'])
      db.runCommand({ ping: 1 }, function (err, res) {
        if (!err && res.ok) {
          grunt.log.write('OK.')
        }
        return callback()
      })
      return db.on('error', function (err) {
        err = 'Can not connect to mongodb'
        grunt.log.error('FAIL.')
        grunt.log.errorlns(`\
!!!!!!!!!!!!!! MONGO ERROR !!!!!!!!!!!!!!

ShareLaTeX can not talk to the mongodb instance

Check the mongodb instance is running and accessible on env var SHARELATEX_MONGO_URL

!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\
`)
        throw new Error('Can not connect to Mongodb')
        return callback(err)
      })
    },

    checkRedisConnect(callback) {
      if (callback == null) {
        callback = function (error) {}
      }
      grunt.log.write('Checking can connect to redis\n')
      const rclient = require('redis').createClient(settings.redis.web)

      rclient.ping(function (err, res) {
        if (err == null) {
          grunt.log.write('OK.')
        } else {
          throw new Error('Can not connect to redis')
        }
        return callback()
      })
      const errorHandler = _.once(function (err) {
        err = 'Can not connect to redis'
        grunt.log.error('FAIL.')
        grunt.log.errorlns(`\
!!!!!!!!!!!!!! REDIS ERROR !!!!!!!!!!!!!!

ShareLaTeX can not talk to the redis instance

Check the redis instance is running and accessible on env var SHARELATEX_REDIS_HOST

!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\
`)
        throw new Error('Can not connect to redis')
        return callback(err)
      })
      return rclient.on('error', errorHandler)
    },
  })
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
