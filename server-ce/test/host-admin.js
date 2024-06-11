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

const PATHS = {
  DOCKER_COMPOSE_OVERRIDE: 'docker-compose.override.yml',
  DATA_DIR: Path.join(__dirname, 'data'),
  SANDBOXED_COMPILES_HOST_DIR: Path.join(__dirname, 'data/compiles'),
}
const IMAGES = {
  CE: process.env.IMAGE_TAG_CE.replace(/:.+/, ''),
  PRO: process.env.IMAGE_TAG_PRO.replace(/:.+/, ''),
}

let mongoIsInitialized = false

function readDockerComposeOverride() {
  try {
    return YAML.load(fs.readFileSync(PATHS.DOCKER_COMPOSE_OVERRIDE, 'utf-8'))
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error
    }
    return {
      services: {
        sharelatex: {
          environment: {},
        },
        'git-bridge': {},
      },
    }
  }
}

function writeDockerComposeOverride(cfg) {
  fs.writeFileSync(PATHS.DOCKER_COMPOSE_OVERRIDE, YAML.dump(cfg))
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
  console.log(req.method, req.url, req.body)
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'http://sharelatex')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Max-Age', '3600')
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
      },
    },
    { allowUnknown: false }
  ),
  (req, res) => {
    const { cwd, script, args } = req.body

    execFile(
      'docker',
      [
        'compose',
        'exec',
        'sharelatex',
        'bash',
        '-c',
        `source /etc/container_environment.sh && source /etc/overleaf/env.sh || source /etc/sharelatex/env.sh && cd ${JSON.stringify(cwd)} && node ${JSON.stringify(script)} ${args.map(a => JSON.stringify(a)).join(' ')}`,
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
      'DOCKER_RUNNER',
      'SANDBOXED_COMPILES',
      'SANDBOXED_COMPILES_SIBLING_CONTAINERS',
      'ALL_TEX_LIVE_DOCKER_IMAGE_NAMES',
      'OVERLEAF_TEMPLATES_USER_ID',
      'OVERLEAF_NEW_PROJECT_TEMPLATE_LINKS',
      'OVERLEAF_ALLOW_PUBLIC_ACCESS',
      'OVERLEAF_ALLOW_ANONYMOUS_READ_AND_WRITE_SHARING',
      // Old branding, used for upgrade tests
      'SHARELATEX_MONGO_URL',
      'SHARELATEX_REDIS_HOST',
    ].map(name => [name, Joi.string()])
  )
)

function setVarsDockerCompose({ pro, vars, version, withDataDir }) {
  const cfg = readDockerComposeOverride()

  cfg.services.sharelatex.image = `${pro ? IMAGES.PRO : IMAGES.CE}:${version}`
  cfg.services['git-bridge'].image = `quay.io/sharelatex/git-bridge:${version}`

  cfg.services.sharelatex.environment = vars

  if (cfg.services.sharelatex.environment.GIT_BRIDGE_ENABLED === 'true') {
    cfg.services.sharelatex.depends_on = ['git-bridge']
  } else {
    cfg.services.sharelatex.depends_on = []
  }

  const dataDirInContainer =
    version === 'latest' || version >= '5.0'
      ? '/var/lib/overleaf/data'
      : '/var/lib/sharelatex/data'

  cfg.services.sharelatex.volumes = []
  if (withDataDir) {
    cfg.services.sharelatex.volumes.push(
      `${PATHS.DATA_DIR}:${dataDirInContainer}`
    )
  }

  if (
    cfg.services.sharelatex.environment
      .SANDBOXED_COMPILES_SIBLING_CONTAINERS === 'true'
  ) {
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
        `${PATHS.SANDBOXED_COMPILES_HOST_DIR}:${dataDirInContainer}/compiles`
      )
    }
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
          '--timeout',
          '0',
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
    if (['stop', 'down'].includes(cmd)) {
      mongoIsInitialized = false
    }
    execFile('docker', ['compose', cmd, ...args], (error, stdout, stderr) => {
      res.json({ error, stdout, stderr })
    })
  }
)

function mongoInit(callback) {
  execFile(
    'docker',
    ['compose', 'up', '--detach', '--wait', 'mongo'],
    (error, stdout, stderr) => {
      if (error) return callback(error, stdout, stderr)

      execFile(
        'docker',
        [
          'compose',
          'exec',
          'mongo',
          'mongo',
          '--eval',
          'rs.initiate({ _id: "overleaf", members: [ { _id: 0, host: "mongo:27017" } ] })',
        ],
        (error, stdout, stderr) => {
          if (!error) {
            mongoIsInitialized = true
          }
          callback(error, stdout, stderr)
        }
      )
    }
  )
}

app.post('/mongo/init', (req, res) => {
  mongoInit((error, stdout, stderr) => {
    res.json({ error, stdout, stderr })
  })
})

app.post(
  '/reconfigure',
  validate(
    {
      body: {
        pro: Joi.boolean().required(),
        version: Joi.string().required(),
        vars: allowedVars,
        withDataDir: Joi.boolean().optional(),
      },
    },
    { allowUnknown: false }
  ),
  (req, res) => {
    const { pro, version, vars, withDataDir } = req.body
    try {
      setVarsDockerCompose({ pro, version, vars, withDataDir })
    } catch (error) {
      return res.json({ error })
    }

    const doMongoInit = mongoIsInitialized ? cb => cb() : mongoInit
    doMongoInit((error, stdout, stderr) => {
      if (error) return res.json({ error, stdout, stderr })

      execFile(
        'docker',
        ['compose', 'up', '--detach', '--wait', 'sharelatex'],
        (error, stdout, stderr) => {
          res.json({ error, stdout, stderr })
        }
      )
    })
  }
)

app.post('/reset/data', (req, res) => {
  execFile(
    'docker',
    ['compose', 'stop', '--timeout=0', 'sharelatex'],
    (error, stdout, stderr) => {
      if (error) return res.json({ error, stdout, stderr })

      try {
        purgeDataDir()
      } catch (error) {
        return res.json({ error })
      }

      mongoIsInitialized = false
      execFile(
        'docker',
        ['compose', 'down', '--timeout=0', '--volumes', 'mongo', 'redis'],
        (error, stdout, stderr) => {
          res.json({ error, stdout, stderr })
        }
      )
    }
  )
})

app.use(handleValidationErrors())

purgeDataDir()

// Init on startup
mongoInit(err => {
  if (err) {
    console.error('mongo init failed', err)
    process.exit(1)
  }

  app.listen(80)
})
