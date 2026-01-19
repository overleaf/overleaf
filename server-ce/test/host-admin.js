import fs from 'node:fs'
import Path from 'node:path'
import { promisify } from 'node:util'
import { execFile as execFileCb } from 'node:child_process'
import bodyParser from 'body-parser'
import express from 'express'
import YAML from 'js-yaml'
import { isZodErrorLike } from 'zod-validation-error'
import { ParamsError, parseReq, z } from '@overleaf/validation-tools'
import { expressify } from '@overleaf/promise-utils'

const execFile = promisify(execFileCb)

const DATA_DIR = Path.join(
  import.meta.dirname,
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
      mongo: {},
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
    return defaultDockerComposeOverride()
  }
}

function writeDockerComposeOverride(cfg) {
  fs.writeFileSync(PATHS.DOCKER_COMPOSE_OVERRIDE, YAML.dump(cfg))
}

async function runDockerCompose(command, args) {
  const files = ['-f', PATHS.DOCKER_COMPOSE_FILE]
  if (process.env.NATIVE_CYPRESS) {
    files.push('-f', PATHS.DOCKER_COMPOSE_NATIVE)
  }
  if (fs.existsSync(PATHS.DOCKER_COMPOSE_OVERRIDE)) {
    files.push('-f', PATHS.DOCKER_COMPOSE_OVERRIDE)
  }
  return await execFile('docker', ['compose', ...files, command, ...args])
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
  expressify(async (req, res) => {
    const {
      body: { cwd, script, args, user, hasOverleafEnv },
    } = parseReq(
      req,
      z.object({
        body: z.object({
          cwd: z.string(),
          script: z.string(),
          args: z.array(z.string()),
          user: z.string(),
          hasOverleafEnv: z.boolean(),
        }),
      })
    )

    const env = hasOverleafEnv
      ? 'source /etc/overleaf/env.sh || source /etc/sharelatex/env.sh'
      : 'true'
    try {
      const { stdout, stderr } = await runDockerCompose('exec', [
        '--workdir',
        `/overleaf/${cwd}`,
        'sharelatex',
        'bash',
        '-c',
        `source /etc/container_environment.sh && ${env} && /sbin/setuser ${user} node ${script} ${args.map(a => JSON.stringify(a)).join(' ')}`,
      ])
      res.json({
        stdout,
        stderr,
      })
    } catch (error) {
      return res.json({ error })
    }
  })
)

app.post(
  '/run/gruntTask',
  expressify(async (req, res) => {
    const {
      body: { task, args },
    } = parseReq(
      req,
      z.object({
        body: z.object({
          task: z.string(),
          args: z.array(z.string()),
        }),
      })
    )

    try {
      const { stdout, stderr } = await runDockerCompose('exec', [
        '--workdir',
        '/var/www/sharelatex',
        'sharelatex',
        'bash',
        '-c',
        `source /etc/container_environment.sh && /sbin/setuser www-data grunt ${JSON.stringify(task)} ${args.map(a => JSON.stringify(a)).join(' ')}`,
      ])
      res.json({ stdout, stderr })
    } catch (error) {
      return res.json({ error })
    }
  })
)

const allowedVars = z.object(
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
    ].map(name => [name, z.string().optional()])
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
    cfg.services.mongo.image = `mongo:${mongoVersion}`
  } else {
    delete cfg.services.mongo.image
  }

  if (version === 'latest') {
    cfg.services.mongo.command = '--replSet overleaf --notablescan'
  } else {
    delete cfg.services.mongo.command
  }

  writeDockerComposeOverride(cfg)
}

app.post(
  '/docker/compose/:cmd',
  expressify(async (req, res) => {
    const {
      params: { cmd },
      body: { args },
    } = parseReq(
      req,
      z.object({
        params: z.object({
          cmd: z.literal(['up', 'stop', 'down', 'ps', 'logs']),
        }),
        body: z.object({
          args: z.array(
            z.literal([
              '--detach',
              '--wait',
              '--volumes',
              '--timeout=60',
              'sharelatex',
              'git-bridge',
              'mongo',
              'redis',
            ])
          ),
        }),
      })
    )

    try {
      const { stdout, stderr } = await runDockerCompose(cmd, args)
      res.json({ stdout, stderr })
    } catch (error) {
      return res.json({ error })
    }
  })
)

async function maybeResetData(resetData) {
  if (!resetData) return

  previousConfig = ''
  await runDockerCompose('down', [
    '--timeout=0',
    '--volumes',
    'mongo',
    'redis',
    'sharelatex',
  ])
  purgeDataDir()
}

app.post(
  '/reconfigure',
  expressify(async (req, res) => {
    const {
      body: { pro, version, vars, withDataDir, resetData, mongoVersion },
    } = parseReq(
      req,
      z.object({
        body: z.object({
          pro: z.boolean(),
          version: z.string(),
          vars: allowedVars,
          withDataDir: z.boolean(),
          resetData: z.boolean(),
          mongoVersion: z.string(),
        }),
      })
    )
    try {
      await maybeResetData(resetData)
    } catch (error) {
      return res.json({ error })
    }

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

    try {
      const { stdout, stderr } = await runDockerCompose('up', [
        '--detach',
        '--wait',
        'sharelatex',
      ])
      res.json({ stdout, stderr, previousConfigServer })
    } catch (error) {
      return res.json({
        error,
        previousConfigServer,
      })
    } finally {
      previousConfig = newConfig
    }
  })
)

app.post(
  '/mongo/setFeatureCompatibilityVersion',
  expressify(async (req, res) => {
    const {
      body: { mongoVersion },
    } = parseReq(
      req,
      z.object({
        body: z.object({
          mongoVersion: z.string(),
        }),
      })
    )
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
    try {
      const { stdout, stderr } = await runDockerCompose('exec', [
        'mongo',
        mongosh,
        '--eval',
        `db.adminCommand(${JSON.stringify(params)})`,
      ])
      res.json({ stdout, stderr })
    } catch (error) {
      return res.json({ error })
    }
  })
)

app.get(
  '/redis/keys',
  expressify(async (req, res) => {
    try {
      const { stdout, stderr } = await runDockerCompose('exec', [
        'redis',
        'redis-cli',
        'KEYS',
        '*',
      ])
      res.json({ stdout, stderr })
    } catch (error) {
      return res.json({ error })
    }
  })
)

app.delete(
  '/data/user_files',
  expressify(async (req, res) => {
    try {
      const { stdout, stderr } = await runDockerCompose('exec', [
        'sharelatex',
        'rm',
        '-vrf',
        '/var/lib/overleaf/data/user_files',
      ])
      res.json({ stdout, stderr })
    } catch (error) {
      return res.json({ error })
    }
  })
)

app.use((error, req, res, next) => {
  if (error instanceof ParamsError) {
    res.status(404).json({ error })
  } else if (isZodErrorLike(error)) {
    res.status(400).json({ error })
  }
  next(error)
})

purgeDataDir()
writeDockerComposeOverride(defaultDockerComposeOverride())

app.listen(80)
