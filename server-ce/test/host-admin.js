const fs = require('fs')
const { execFile } = require('child_process')
const express = require('express')
const bodyParser = require('body-parser')
const {
  celebrate: validate,
  Joi,
  errors: handleValidationErrors,
} = require('celebrate')
const YAML = require('js-yaml')

const FILES = {
  DOCKER_COMPOSE: 'docker-compose.override.yml',
}
const IMAGES = {
  CE: process.env.IMAGE_TAG_CE.replace(/:.+/, ''),
  PRO: process.env.IMAGE_TAG_PRO.replace(/:.+/, ''),
}

let mongoIsInitialized = false

function readDockerComposeOverride() {
  try {
    return YAML.load(fs.readFileSync(FILES.DOCKER_COMPOSE, 'utf-8'))
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error
    }
    return {
      services: {
        sharelatex: {
          environment: {},
        },
      },
    }
  }
}

function writeDockerComposeOverride(cfg) {
  fs.writeFileSync(FILES.DOCKER_COMPOSE, YAML.dump(cfg))
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
        `source /etc/container_environment.sh && source /etc/overleaf/env.sh && cd ${JSON.stringify(cwd)} && node ${JSON.stringify(script)} ${args.map(a => JSON.stringify(a)).join(' ')}`,
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

function setVersionDockerCompose({ pro, version }) {
  const cfg = readDockerComposeOverride()

  cfg.services.sharelatex.image = `${pro ? IMAGES.PRO : IMAGES.CE}:${version}`

  writeDockerComposeOverride(cfg)
}

app.post(
  '/set/version',
  validate(
    {
      body: {
        pro: Joi.boolean(),
        version: Joi.string().required(),
        path: Joi.allow(
          'docker-compose.yml'
          // When extending testing for Toolkit:
          // 'config/version'
        ),
      },
    },
    { allowUnknown: false }
  ),
  (req, res) => {
    const { pro, version } = req.body
    if (req.body.path === 'docker-compose.yml') {
      try {
        setVersionDockerCompose({ pro, version })
      } catch (error) {
        return res.json({ error })
      }
    }
    res.json({})
  }
)

const allowedVars = Joi.object().keys({
  OVERLEAF_APP_NAME: Joi.string(),
  OVERLEAF_LEFT_FOOTER: Joi.string(),
  OVERLEAF_RIGHT_FOOTER: Joi.string(),
})

function setVarsDockerCompose({ vars }) {
  const cfg = readDockerComposeOverride()

  cfg.services.sharelatex.environment = vars

  writeDockerComposeOverride(cfg)
}

app.post(
  '/set/vars',
  validate(
    {
      body: {
        vars: allowedVars,
        path: Joi.allow(
          'docker-compose.yml'
          // When extending the testing for Toolkit:
          // 'overleaf.rc', 'variables.env'
        ),
      },
    },
    { allowUnknown: false }
  ),
  (req, res) => {
    if (req.body.path === 'docker-compose.yml') {
      const { vars } = req.body
      try {
        setVarsDockerCompose({ vars })
      } catch (error) {
        return res.json({ error })
      }
    }
    res.json({})
  }
)

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
      },
    },
    { allowUnknown: false }
  ),
  (req, res) => {
    const doMongoInit = mongoIsInitialized ? cb => cb() : mongoInit
    doMongoInit((error, stdout, stderr) => {
      if (error) return res.json({ error, stdout, stderr })

      const { pro, version, vars } = req.body
      try {
        setVersionDockerCompose({ pro, version })
        setVarsDockerCompose({ vars })
      } catch (error) {
        return res.json({ error })
      }

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

app.use(handleValidationErrors())

// Init on startup
mongoInit(err => {
  if (err) {
    console.error('mongo init failed', err)
    process.exit(1)
  }

  app.listen(80)
})
