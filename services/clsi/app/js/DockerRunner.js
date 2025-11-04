const { promisify } = require('node:util')
const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
const Docker = require('dockerode')
const dockerode = new Docker()
const crypto = require('node:crypto')
const async = require('async')
const LockManager = require('./DockerLockManager')
const Path = require('node:path')
const _ = require('lodash')

const ONE_HOUR_IN_MS = 60 * 60 * 1000
logger.debug('using docker runner')

let containerMonitorTimeout
let containerMonitorInterval

const DockerRunner = {
  run(
    projectId,
    command,
    directory,
    image,
    timeout,
    environment,
    compileGroup,
    callback
  ) {
    command = command.map(arg =>
      arg.toString().replace('$COMPILE_DIR', '/compile')
    )
    if (image == null) {
      image = Settings.clsi.docker.image
    }

    if (
      Settings.clsi.docker.allowedImages &&
      !Settings.clsi.docker.allowedImages.includes(image)
    ) {
      return callback(new Error('image not allowed'))
    }

    if (Settings.texliveImageNameOveride != null) {
      const img = image.split('/')
      image = `${Settings.texliveImageNameOveride}/${img[2]}`
    }

    if (compileGroup === 'synctex-output') {
      // In: directory = '/overleaf/services/clsi/output/projectId-userId/generated-files/buildId'
      //             directory.split('/').slice(-3) === 'projectId-userId/generated-files/buildId'
      //  sandboxedCompilesHostDirOutput = '/host/output'
      // Out:                  directory = '/host/output/projectId-userId/generated-files/buildId'
      directory = Path.join(
        Settings.path.sandboxedCompilesHostDirOutput,
        ...directory.split('/').slice(-3)
      )
    } else {
      // In:   directory = '/overleaf/services/clsi/compiles/projectId-userId'
      //                       Path.basename(directory) === 'projectId-userId'
      //  sandboxedCompilesHostDirCompiles = '/host/compiles'
      // Out:                    directory = '/host/compiles/projectId-userId'
      directory = Path.join(
        Settings.path.sandboxedCompilesHostDirCompiles,
        Path.basename(directory)
      )
    }

    const volumes = { [directory]: '/compile' }
    if (
      compileGroup === 'synctex' ||
      compileGroup === 'synctex-output' ||
      compileGroup === 'wordcount'
    ) {
      volumes[directory] += ':ro'
    }

    const options = DockerRunner._getContainerOptions(
      command,
      image,
      volumes,
      timeout,
      environment,
      compileGroup
    )
    const fingerprint = DockerRunner._fingerprintContainer(options)
    const name = `project-${projectId}-${fingerprint}`
    options.name = name

    // logOptions = _.clone(options)
    // logOptions?.HostConfig?.SecurityOpt = "secomp used, removed in logging"
    logger.debug({ projectId }, 'running docker container')
    DockerRunner._runAndWaitForContainer(
      options,
      volumes,
      timeout,
      (error, output) => {
        if (error && error.statusCode === 500) {
          logger.debug(
            { err: error, projectId },
            'error running container so destroying and retrying'
          )
          DockerRunner.destroyContainer(name, null, true, error => {
            if (error != null) {
              return callback(error)
            }
            DockerRunner._runAndWaitForContainer(
              options,
              volumes,
              timeout,
              callback
            )
          })
        } else {
          callback(error, output)
        }
      }
    )

    // pass back the container name to allow it to be killed
    return name
  },

  kill(containerId, callback) {
    logger.debug({ containerId }, 'sending kill signal to container')
    const container = dockerode.getContainer(containerId)
    container.kill(error => {
      if (
        error != null &&
        error.message != null &&
        error.message.match(/Cannot kill container .* is not running/)
      ) {
        logger.warn(
          { err: error, containerId },
          'container not running, continuing'
        )
        error = null
      }
      if (error != null) {
        logger.error({ err: error, containerId }, 'error killing container')
        callback(error)
      } else {
        callback()
      }
    })
  },

  _runAndWaitForContainer(options, volumes, timeout, _callback) {
    const callback = _.once(_callback)
    const { name } = options

    let streamEnded = false
    let containerReturned = false
    let output = {}

    function callbackIfFinished() {
      if (streamEnded && containerReturned) {
        callback(null, output)
      }
    }

    function attachStreamHandler(error, _output) {
      if (error != null) {
        return callback(error)
      }
      output = _output
      streamEnded = true
      callbackIfFinished()
    }

    DockerRunner.startContainer(
      options,
      volumes,
      attachStreamHandler,
      (error, containerId) => {
        if (error != null) {
          return callback(error)
        }

        DockerRunner.waitForContainer(
          name,
          timeout,
          options,
          (error, exitCode) => {
            if (error != null) {
              return callback(error)
            }
            if (exitCode === 137) {
              // exit status from kill -9
              const err = new Error('terminated')
              err.terminated = true
              return callback(err)
            }
            if (exitCode === 1) {
              // exit status from chktex
              const err = new Error('exited')
              err.code = exitCode
              return callback(err)
            }
            containerReturned = true
            logger.debug(
              // The seccomp policy is very large. Avoid logging it. _.omit deep clones.
              { exitCode, options: _.omit(options, 'HostConfig.SecurityOpt') },
              'docker container has exited'
            )
            callbackIfFinished()
          }
        )
      }
    )
  },

  _getContainerOptions(
    command,
    image,
    volumes,
    timeout,
    environment,
    compileGroup
  ) {
    const timeoutInSeconds = timeout / 1000

    for (const hostVol in volumes) {
      const dockerVol = volumes[hostVol]
      if (volumes[hostVol].slice(-3).indexOf(':r') === -1) {
        volumes[hostVol] = `${dockerVol}:rw`
      }
    }

    // merge settings and environment parameter
    const env = {}
    for (const src of [Settings.clsi.docker.env, environment || {}]) {
      for (const key in src) {
        const value = src[key]
        env[key] = value
      }
    }
    // set the path based on the image year
    const match = image.match(/:([0-9]+)\.[0-9]+/)
    // the rolling build does not follow our <year>.<version>.<patch> convention
    const year = match ? match[1] : 'rolling'

    env.PATH = `/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/local/texlive/${year}/bin/x86_64-linux/`
    const options = {
      Cmd: command,
      Image: image,
      WorkingDir: '/compile',
      NetworkDisabled: true,
      Memory: 1024 * 1024 * 1024 * 1024, // 1 Gb
      User: Settings.clsi.docker.user,
      Env: Object.entries(env).map(([key, value]) => `${key}=${value}`),
      HostConfig: {
        Binds: Object.entries(volumes).map(
          ([hostVol, dockerVol]) => `${hostVol}:${dockerVol}`
        ),
        LogConfig: { Type: 'none', Config: {} },
        Ulimits: [
          {
            Name: 'cpu',
            Soft: timeoutInSeconds + 5,
            Hard: timeoutInSeconds + 10,
          },
        ],
        CapDrop: ['ALL'],
        SecurityOpt: ['no-new-privileges'],
      },
    }

    if (Settings.clsi.docker.seccomp_profile != null) {
      options.HostConfig.SecurityOpt.push(
        `seccomp=${Settings.clsi.docker.seccomp_profile}`
      )
    }

    if (Settings.clsi.docker.apparmor_profile != null) {
      options.HostConfig.SecurityOpt.push(
        `apparmor=${Settings.clsi.docker.apparmor_profile}`
      )
    }

    if (Settings.clsi.docker.runtime) {
      options.HostConfig.Runtime = Settings.clsi.docker.runtime
    }

    if (Settings.clsi.docker.Readonly) {
      options.HostConfig.ReadonlyRootfs = true
      options.HostConfig.Tmpfs = { '/tmp': 'rw,noexec,nosuid,size=65536k' }
      options.Volumes['/home/tex'] = {}
    }

    // Allow per-compile group overriding of individual settings
    if (
      Settings.clsi.docker.compileGroupConfig &&
      Settings.clsi.docker.compileGroupConfig[compileGroup]
    ) {
      const override = Settings.clsi.docker.compileGroupConfig[compileGroup]
      for (const key in override) {
        _.set(options, key, override[key])
      }
    }

    return options
  },

  _fingerprintContainer(containerOptions) {
    // Yay, Hashing!
    const json = JSON.stringify(containerOptions)
    return crypto.createHash('md5').update(json).digest('hex')
  },

  startContainer(options, volumes, attachStreamHandler, callback) {
    LockManager.runWithLock(
      options.name,
      releaseLock =>
        DockerRunner._startContainer(
          options,
          volumes,
          attachStreamHandler,
          releaseLock
        ),
      callback
    )
  },

  // Check that volumes exist and are directories
  _startContainer(options, volumes, attachStreamHandler, callback) {
    callback = _.once(callback)
    const { name } = options

    logger.debug({ containerName: name }, 'starting container')
    const container = dockerode.getContainer(name)

    function createAndStartContainer() {
      dockerode.createContainer(options, (error, container) => {
        if (error != null) {
          return callback(error)
        }
        startExistingContainer()
      })
    }

    function startExistingContainer() {
      DockerRunner.attachToContainer(
        options.name,
        attachStreamHandler,
        error => {
          if (error != null) {
            return callback(error)
          }
          container.start(error => {
            if (error != null && error.statusCode !== 304) {
              callback(error)
            } else {
              // already running
              callback()
            }
          })
        }
      )
    }

    container.inspect((error, stats) => {
      if (error != null && error.statusCode === 404) {
        createAndStartContainer()
      } else if (error != null) {
        logger.err(
          { containerName: name, error },
          'unable to inspect container to start'
        )
        callback(error)
      } else {
        startExistingContainer()
      }
    })
  },

  attachToContainer(containerId, attachStreamHandler, attachStartCallback) {
    const container = dockerode.getContainer(containerId)
    container.attach({ stdout: 1, stderr: 1, stream: 1 }, (error, stream) => {
      if (error != null) {
        logger.error(
          { err: error, containerId },
          'error attaching to container'
        )
        return attachStartCallback(error)
      } else {
        attachStartCallback()
      }

      logger.debug({ containerId }, 'attached to container')

      const MAX_OUTPUT = 1024 * 1024 * 2 // limit output to 2MB
      function createStringOutputStream(name) {
        return {
          data: '',
          overflowed: false,
          write(data) {
            if (this.overflowed) {
              return
            }
            if (this.data.length < MAX_OUTPUT) {
              this.data += data
            } else {
              logger.info(
                {
                  containerId,
                  length: this.data.length,
                  maxLen: MAX_OUTPUT,
                },
                `${name} exceeds max size`
              )
              this.data += `(...truncated at ${MAX_OUTPUT} chars...)`
              this.overflowed = true
            }
          },
          // kill container if too much output
          // docker.containers.kill(containerId, () ->)
        }
      }

      const stdout = createStringOutputStream('stdout')
      const stderr = createStringOutputStream('stderr')

      container.modem.demuxStream(stream, stdout, stderr)

      stream.on('error', err =>
        logger.error(
          { err, containerId },
          'error reading from container stream'
        )
      )

      stream.on('end', () =>
        attachStreamHandler(null, { stdout: stdout.data, stderr: stderr.data })
      )
    })
  },

  waitForContainer(containerId, timeout, options, _callback) {
    const callback = _.once(_callback)

    const container = dockerode.getContainer(containerId)

    let timedOut = false
    const timeoutId = setTimeout(() => {
      timedOut = true
      logger.debug({ containerId }, 'timeout reached, killing container')
      container.kill(err => {
        logger.warn({ err, containerId }, 'failed to kill container')
      })
    }, timeout)

    logger.debug({ containerId }, 'waiting for docker container')
    container.wait((error, res) => {
      if (error?.statusCode === 404 && options.HostConfig.AutoRemove) {
        logger.debug(
          { containerId },
          'auto-destroy container destroyed before starting to wait'
        )
        clearTimeout(timeoutId)
        return callback(null, 0)
      }
      if (error != null) {
        clearTimeout(timeoutId)
        logger.warn({ err: error, containerId }, 'error waiting for container')
        return callback(error)
      }
      if (timedOut) {
        logger.debug({ containerId }, 'docker container timed out')
        error = new Error('container timed out')
        error.timedout = true
        callback(error)
      } else {
        clearTimeout(timeoutId)
        logger.debug(
          { containerId, exitCode: res.StatusCode },
          'docker container returned'
        )
        callback(null, res.StatusCode)
      }
    })
  },

  destroyContainer(containerName, containerId, shouldForce, callback) {
    // We want the containerName for the lock and, ideally, the
    // containerId to delete.  There is a bug in the docker.io module
    // where if you delete by name and there is an error, it throws an
    // async exception, but if you delete by id it just does a normal
    // error callback. We fall back to deleting by name if no id is
    // supplied.
    LockManager.runWithLock(
      containerName,
      releaseLock =>
        DockerRunner._destroyContainer(
          containerId || containerName,
          shouldForce,
          releaseLock
        ),
      callback
    )
  },

  _destroyContainer(containerId, shouldForce, callback) {
    logger.debug({ containerId }, 'destroying docker container')
    const container = dockerode.getContainer(containerId)
    container.remove({ force: shouldForce === true, v: true }, error => {
      if (error != null && error.statusCode === 404) {
        logger.warn(
          { err: error, containerId },
          'container not found, continuing'
        )
        error = null
      }
      if (error != null) {
        logger.error({ err: error, containerId }, 'error destroying container')
      } else {
        logger.debug({ containerId }, 'destroyed container')
      }
      callback(error)
    })
  },

  // handle expiry of docker containers

  MAX_CONTAINER_AGE: Settings.clsi.docker.maxContainerAge || ONE_HOUR_IN_MS,

  examineOldContainer(container, callback) {
    const name = container.Name || (container.Names && container.Names[0])
    const created = container.Created * 1000 // creation time is returned in seconds
    const now = Date.now()
    const age = now - created
    const maxAge = DockerRunner.MAX_CONTAINER_AGE
    const ttl = maxAge - age
    logger.debug(
      { containerName: name, created, now, age, maxAge, ttl },
      'checking whether to destroy container'
    )
    return { name, id: container.Id, ttl }
  },

  destroyOldContainers(callback) {
    dockerode.listContainers({ all: true }, (error, containers) => {
      if (error != null) {
        return callback(error)
      }
      const jobs = []
      for (const container of containers) {
        const { name, id, ttl } = DockerRunner.examineOldContainer(container)
        if (name.slice(0, 9) === '/project-' && ttl <= 0) {
          // strip the / prefix
          // the LockManager uses the plain container name
          const plainName = name.slice(1)
          jobs.push(cb =>
            DockerRunner.destroyContainer(plainName, id, false, () => cb())
          )
        }
      }
      // Ignore errors because some containers get stuck but
      // will be destroyed next time
      async.series(jobs, callback)
    })
  },

  startContainerMonitor() {
    logger.debug(
      { maxAge: DockerRunner.MAX_CONTAINER_AGE },
      'starting container expiry'
    )

    // guarantee only one monitor is running
    DockerRunner.stopContainerMonitor()

    // randomise the start time
    const randomDelay = Math.floor(Math.random() * 5 * 60 * 1000)
    containerMonitorTimeout = setTimeout(() => {
      containerMonitorInterval = setInterval(
        () =>
          DockerRunner.destroyOldContainers(err => {
            if (err) {
              logger.error({ err }, 'failed to destroy old containers')
            }
          }),
        ONE_HOUR_IN_MS
      )
    }, randomDelay)
  },

  stopContainerMonitor() {
    if (containerMonitorTimeout) {
      clearTimeout(containerMonitorTimeout)
      containerMonitorTimeout = undefined
    }
    if (containerMonitorInterval) {
      clearInterval(containerMonitorInterval)
      containerMonitorInterval = undefined
    }
  },

  canRunSyncTeXInOutputDir() {
    return Boolean(Settings.path.sandboxedCompilesHostDirOutput)
  },
}

DockerRunner.startContainerMonitor()

module.exports = DockerRunner
module.exports.promises = {
  run: promisify(DockerRunner.run),
  kill: promisify(DockerRunner.kill),
}
