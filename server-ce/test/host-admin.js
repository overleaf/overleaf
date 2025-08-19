const fs = require('fs')
const Path = require('path')
const { execFile } = require('child_process')
const express = require('express')
const bodyParser = require('body-parser')
const {
  celebrate: validate,
  Joi,
  errors: handleValidationErrors,
} = require('celebrate')
const YAML = require('js-yaml')

const DATA_DIR = Path.join(
  __dirname,
  'data',
  // Give each shard their own data dir.
  process.env.CYPRESS_SHARD || 'default'
)
const PATHS = {
  DOCKER_COMPOSE_FILE: 'docker-compose.yml',
  // Give each shard their own override file.
  DOCKER_COMPOSE_OVERRIDE: `docker-compose.${process.env.CYPRESS_SHARD || 'override'}.yml`,
  DOCKER_COMPOSE_NATIVE: 'docker-compose.native.yml',
  DATA_DIR,
  SANDBOXED_COMPILES_HOST_DIR: Path.join(DATA_DIR, 'compiles'),
}
const IMAGES = {
  CE: process.env.IMAGE_TAG_CE.replace(/:.+/, ''),
  PRO: process.env.IMAGE_TAG_PRO.replace(/:.+/, ''),
}
const LATEST = {
  CE: process.env.IMAGE_TAG_CE.replace(/.+:/, '') || 'latest',
  PRO: process.env.IMAGE_TAG_PRO.replace(/.+:/, '') || 'latest',
  GIT_BRIDGE: 'latest', // TODO, build in CI?
}

function defaultDockerComposeOverride() {
  return {
    services: {
      sharelatex: {
        environment: {},
      },
      'git-bridge': {},
    },
  }
}

let previousConfig = ''

function readDockerComposeOverride() {
  try {
    return YAML.load(fs.readFileSync(PATHS.DOCKER_COMPOSE_OVERRIDE, 'utf-8'))
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error
    }
    return defaultDockerComposeOverride
  }
}

function writeDockerComposeOverride(cfg) {
  fs.writeFileSync(PATHS.DOCKER_COMPOSE_OVERRIDE, YAML.dump(cfg))
}

function runDockerCompose(command, args, callback) {
  const files = ['-f', PATHS.DOCKER_COMPOSE_FILE]
  if (process.env.NATIVE_CYPRESS) {
    files.push('-f', PATHS.DOCKER_COMPOSE_NATIVE)
  }
  if (fs.existsSync(PATHS.DOCKER_COMPOSE_OVERRIDE)) {
    files.push('-f', PATHS.DOCKER_COMPOSE_OVERRIDE)
  }
  execFile('docker', ['compose', ...files, command, ...args], callback)
}

function purgeDataDir() {
  fs.rmSync(PATHS.DATA_DIR, { recursive: true, force: true })
}

const app = express()
app.get('/status', (req, res) => {
  res.send('host-admin is up')
})

app.use(bodyParser.json())
app.use((req, res, next) => {
  // Basic access logs
  if (process.env.CI !== 'true') {
    console.log(req.method, req.url, req.body)
  }
  const json = res.json
  res.json = body => {
    if (process.env.CI !== 'true' || body.error) {
      console.log(req.method, req.url, req.body, '->', body)
    }
    json.call(res, body)
  }
  next()
})
app.use((req, res, next) => {
  // Add CORS headers
  const accessControlAllowOrigin =
    process.env.ACCESS_CONTROL_ALLOW_ORIGIN || 'http://sharelatex'
  res.setHeader('Access-Control-Allow-Origin', accessControlAllowOrigin)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Max-Age', '3600')
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, GET, HEAD, POST, PUT')
  next()
})

app.post(
  '/run/script',
  validate(
    {
      body: {
        cwd: Joi.string().required(),
        script: Joi.string().required(),
        args: Joi.array().items(Joi.string()),
        user: Joi.string().required(),
        hasOverleafEnv: Joi.boolean().required(),
      },
    },
    { allowUnknown: false }
  ),
  (req, res) => {
    const { cwd, script, args, user, hasOverleafEnv } = req.body

    const env = hasOverleafEnv
      ? 'source /etc/overleaf/env.sh || source /etc/sharelatex/env.sh'
      : 'true'

    runDockerCompose(
      'exec',
      [
        '--workdir',
        `/overleaf/${cwd}`,
        'sharelatex',
        'bash',
        '-c',
        `source /etc/container_environment.sh && ${env} && /sbin/setuser ${user} node ${script} ${args.map(a => JSON.stringify(a)).join(' ')}`,
      ],
      (error, stdout, stderr) => {
        res.json({
          error,
          stdout,
          stderr,
        })
      }
    )
  }
)

app.post(
  '/run/gruntTask',
  validate(
    {
      body: {
        task: Joi.string().required(),
        args: Joi.array().items(Joi.string()),
      },
    },
    { allowUnknown: false }
  ),
  (req, res) => {
    const { task, args } = req.body

    runDockerCompose(
      'exec',
      [
        '--workdir',
        '/var/www/sharelatex',
        'sharelatex',
        'bash',
        '-c',
        `source /etc/container_environment.sh && /sbin/setuser www-data grunt ${JSON.stringify(task)} ${args.map(a => JSON.stringify(a)).join(' ')}`,
      ],
      (error, stdout, stderr) => {
        res.json({
          error,
          stdout,
          stderr,
        })
      }
    )
  }
)

const allowedVars = Joi.object(
  Object.fromEntries(
    [
      'OVERLEAF_APP_NAME',
      'OVERLEAF_LEFT_FOOTER',
      'OVERLEAF_RIGHT_FOOTER',
      'OVERLEAF_PROXY_LEARN',
      'GIT_BRIDGE_ENABLED',
      'GIT_BRIDGE_HOST',
      'GIT_BRIDGE_PORT',
      'V1_HISTORY_URL',
      'SANDBOXED_COMPILES',
      'ALL_TEX_LIVE_DOCKER_IMAGE_NAMES',
      'OVERLEAF_FILESTORE_MIGRATION_LEVEL',
      'OVERLEAF_TEMPLATES_USER_ID',
      'OVERLEAF_NEW_PROJECT_TEMPLATE_LINKS',
      'OVERLEAF_ALLOW_PUBLIC_ACCESS',
      'OVERLEAF_ALLOW_ANONYMOUS_READ_AND_WRITE_SHARING',
      'OVERLEAF_DISABLE_LINK_SHARING',
      'EXTERNAL_AUTH',
      'OVERLEAF_SAML_ENTRYPOINT',
      'OVERLEAF_SAML_CALLBACK_URL',
      'OVERLEAF_SAML_ISSUER',
      'OVERLEAF_SAML_IDENTITY_SERVICE_NAME',
      'OVERLEAF_SAML_EMAIL_FIELD',
      'OVERLEAF_SAML_FIRST_NAME_FIELD',
      'OVERLEAF_SAML_LAST_NAME_FIELD',
      'OVERLEAF_SAML_UPDATE_USER_DETAILS_ON_LOGIN',
      'OVERLEAF_SAML_CERT',
      'OVERLEAF_LDAP_URL',
      'OVERLEAF_LDAP_SEARCH_BASE',
      'OVERLEAF_LDAP_SEARCH_FILTER',
      'OVERLEAF_LDAP_BIND_DN',
      'OVERLEAF_LDAP_BIND_CREDENTIALS',
      'OVERLEAF_LDAP_EMAIL_ATT',
      'OVERLEAF_LDAP_NAME_ATT',
      'OVERLEAF_LDAP_LAST_NAME_ATT',
      'OVERLEAF_LDAP_UPDATE_USER_DETAILS_ON_LOGIN',
      // Old branding, used for upgrade tests
      'SHARELATEX_SITE_URL',
      'SHARELATEX_MONGO_URL',
      'SHARELATEX_REDIS_HOST',
    ].map(name => [name, Joi.string()])
  )
)

function setVarsDockerCompose({
  pro,
  vars,
  version,
  withDataDir,
  mongoVersion,
}) {
  const cfg = readDockerComposeOverride()

  cfg.services.sharelatex.image = `${pro ? IMAGES.PRO : IMAGES.CE}:${version === 'latest' ? (pro ? LATEST.PRO : LATEST.CE) : version}`
  cfg.services['git-bridge'].image =
    `quay.io/sharelatex/git-bridge:${version === 'latest' ? LATEST.GIT_BRIDGE : version}`

  cfg.services.sharelatex.environment = vars

  if (cfg.services.sharelatex.environment.GIT_BRIDGE_ENABLED === 'true') {
    cfg.services.sharelatex.depends_on = ['git-bridge']
  } else {
    cfg.services.sharelatex.depends_on = []
  }

  if (['ldap', 'saml'].includes(vars.EXTERNAL_AUTH)) {
    cfg.services.sharelatex.depends_on.push(vars.EXTERNAL_AUTH)
  }

  const dataDirInContainer =
    version === 'latest' || version >= '5.0'
      ? '/var/lib/overleaf'
      : '/var/lib/sharelatex'

  cfg.services.sharelatex.volumes = []
  if (withDataDir) {
    cfg.services.sharelatex.volumes.push(
      `${PATHS.DATA_DIR}:${dataDirInContainer}`
    )
  }

  if (cfg.services.sharelatex.environment.SANDBOXED_COMPILES === 'true') {
    cfg.services.sharelatex.environment.SANDBOXED_COMPILES_HOST_DIR =
      PATHS.SANDBOXED_COMPILES_HOST_DIR
    cfg.services.sharelatex.environment.TEX_LIVE_DOCKER_IMAGE =
      process.env.TEX_LIVE_DOCKER_IMAGE
    cfg.services.sharelatex.environment.ALL_TEX_LIVE_DOCKER_IMAGES =
      process.env.ALL_TEX_LIVE_DOCKER_IMAGES
    cfg.services.sharelatex.volumes.push(
      '/var/run/docker.sock:/var/run/docker.sock'
    )
    if (!withDataDir) {
      cfg.services.sharelatex.volumes.push(
        `${PATHS.SANDBOXED_COMPILES_HOST_DIR}:${dataDirInContainer}/data/compiles`
      )
    }
  }

  if (mongoVersion) {
    cfg.services.mongo = {
      image: `mongo:${mongoVersion}`,
    }
  } else {
    delete cfg.services.mongo
  }

  writeDockerComposeOverride(cfg)
}

app.post(
  '/docker/compose/:cmd',
  validate(
    {
      body: {
        args: Joi.array().allow(
          '--detach',
          '--wait',
          '--volumes',
          '--timeout=60',
          'sharelatex',
          'git-bridge',
          'mongo',
          'redis'
        ),
      },
      params: {
        cmd: Joi.allow('up', 'stop', 'down', 'ps', 'logs'),
      },
    },
    { allowUnknown: false }
  ),
  (req, res) => {
    const { cmd } = req.params
    const { args } = req.body
    runDockerCompose(cmd, args, (error, stdout, stderr) => {
      res.json({ error, stdout, stderr })
    })
  }
)

function maybeResetData(resetData, callback) {
  if (!resetData) return callback()

  previousConfig = ''
  runDockerCompose(
    'down',
    ['--timeout=0', '--volumes', 'mongo', 'redis', 'sharelatex'],
    (error, stdout, stderr) => {
      if (error) return callback(error, stdout, stderr)

      try {
        purgeDataDir()
      } catch (error) {
        return callback(error)
      }
      callback()
    }
  )
}

app.post(
  '/reconfigure',
  validate(
    {
      body: {
        pro: Joi.boolean().required(),
        mongoVersion: Joi.string().allow('').optional(),
        version: Joi.string().required(),
        vars: allowedVars,
        withDataDir: Joi.boolean().optional(),
        resetData: Joi.boolean().optional(),
      },
    },
    { allowUnknown: false }
  ),
  (req, res) => {
    const { pro, version, vars, withDataDir, resetData, mongoVersion } =
      req.body
    maybeResetData(resetData, (error, stdout, stderr) => {
      if (error) return res.json({ error, stdout, stderr })

      const previousConfigServer = previousConfig
      const newConfig = JSON.stringify(req.body)
      if (previousConfig === newConfig) {
        return res.json({ previousConfigServer })
      }

      try {
        setVarsDockerCompose({ pro, version, vars, withDataDir, mongoVersion })
      } catch (error) {
        return res.json({ error })
      }

      if (error) return res.json({ error, stdout, stderr })
      runDockerCompose(
        'up',
        ['--detach', '--wait', 'sharelatex'],
        (error, stdout, stderr) => {
          previousConfig = newConfig
          res.json({ error, stdout, stderr, previousConfigServer })
        }
      )
    })
  }
)

app.post(
  '/mongo/setFeatureCompatibilityVersion',
  validate(
    {
      body: {
        mongoVersion: Joi.string().required(),
      },
    },
    { allowUnknown: false }
  ),
  (req, res) => {
    const { mongoVersion } = req.body
    const mongosh = mongoVersion > '5' ? 'mongosh' : 'mongo'
    const params = {
      setFeatureCompatibilityVersion: mongoVersion,
    }
    if (mongoVersion >= '7.0') {
      // MongoServerError: Once you have upgraded to 7.0, you will not be able to downgrade FCV and binary version without support assistance. Please re-run this command with 'confirm: true' to acknowledge this and continue with the FCV upgrade.
      // NOTE: 6.0 does not know about this flag. So conditionally add it.
      // MongoServerError: BSON field 'setFeatureCompatibilityVersion.confirm' is an unknown field.
      params.confirm = true
    }
    runDockerCompose(
      'exec',
      [
        'mongo',
        mongosh,
        '--eval',
        `db.adminCommand(${JSON.stringify(params)})`,
      ],
      (error, stdout, stderr) => {
        res.json({ error, stdout, stderr })
      }
    )
  }
)

app.get('/redis/keys', (req, res) => {
  runDockerCompose(
    'exec',
    ['redis', 'redis-cli', 'KEYS', '*'],
    (error, stdout, stderr) => {
      res.json({ error, stdout, stderr })
    }
  )
})

app.delete('/data/user_files', (req, res) => {
  runDockerCompose(
    'exec',
    ['sharelatex', 'rm', '-rf', '/var/lib/overleaf/data/user_files'],
    (error, stdout, stderr) => {
      res.json({ error, stdout, stderr })
    }
  )
})

app.use(handleValidationErrors())

purgeDataDir()
writeDockerComposeOverride(defaultDockerComposeOverride())

app.listen(80)
