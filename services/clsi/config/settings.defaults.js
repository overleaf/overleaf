const Path = require('node:path')
const os = require('node:os')
const http = require('node:http')
const https = require('node:https')

http.globalAgent.keepAlive = false
https.globalAgent.keepAlive = false
const isPreEmptible = os.hostname().includes('pre-emp')

module.exports = {
  compileSizeLimit: process.env.COMPILE_SIZE_LIMIT || '7mb',

  processLifespanLimitMs:
    parseInt(process.env.PROCESS_LIFE_SPAN_LIMIT_MS) || 60 * 60 * 24 * 1000 * 2,

  catchErrors: process.env.CATCH_ERRORS === 'true',

  path: {
    compilesDir:
      process.env.CLSI_COMPILES_PATH || Path.resolve(__dirname, '../compiles'),
    outputDir:
      process.env.CLSI_OUTPUT_PATH || Path.resolve(__dirname, '../output'),
    clsiCacheDir:
      process.env.CLSI_CACHE_PATH || Path.resolve(__dirname, '../cache'),
    synctexBaseDir(projectId) {
      return Path.join(this.compilesDir, projectId)
    },
  },

  internal: {
    clsi: {
      port: 3013,
      host: process.env.LISTEN_ADDRESS || '127.0.0.1',
    },

    load_balancer_agent: {
      report_load: process.env.LOAD_BALANCER_AGENT_REPORT_LOAD !== 'false',
      load_port: 3048,
      local_port: 3049,
    },
  },
  apis: {
    clsi: {
      // Internal requests (used by tests only at the time of writing).
      url: `http://${process.env.CLSI_HOST || '127.0.0.1'}:3013`,
      // External url prefix for output files, e.g. for requests via load-balancers.
      outputUrlPrefix: `${process.env.ZONE ? `/zone/${process.env.ZONE}` : ''}`,
    },
    clsiPerf: {
      host: `${process.env.CLSI_PERF_HOST || '127.0.0.1'}:${
        process.env.CLSI_PERF_PORT || '3043'
      }`,
    },
  },

  smokeTest: process.env.SMOKE_TEST || false,
  project_cache_length_ms: 1000 * 60 * 60 * 24,
  parallelFileDownloads: process.env.FILESTORE_PARALLEL_FILE_DOWNLOADS || 1,
  filestoreDomainOveride: process.env.FILESTORE_DOMAIN_OVERRIDE,
  texliveImageNameOveride: process.env.TEX_LIVE_IMAGE_NAME_OVERRIDE,
  texliveOpenoutAny: process.env.TEXLIVE_OPENOUT_ANY,
  texliveMaxPrintLine: process.env.TEXLIVE_MAX_PRINT_LINE,
  enablePdfCaching: process.env.ENABLE_PDF_CACHING === 'true',
  enablePdfCachingDark: process.env.ENABLE_PDF_CACHING_DARK === 'true',
  pdfCachingMinChunkSize:
    parseInt(process.env.PDF_CACHING_MIN_CHUNK_SIZE, 10) || 1024,
  pdfCachingMaxProcessingTime:
    parseInt(process.env.PDF_CACHING_MAX_PROCESSING_TIME, 10) || 10 * 1000,
  pdfCachingEnableWorkerPool:
    process.env.PDF_CACHING_ENABLE_WORKER_POOL === 'true',
  pdfCachingWorkerPoolSize:
    parseInt(process.env.PDF_CACHING_WORKER_POOL_SIZE, 10) || 4,
  pdfCachingWorkerPoolBackLogLimit:
    parseInt(process.env.PDF_CACHING_WORKER_POOL_BACK_LOG_LIMIT, 10) || 40,
  compileConcurrencyLimit: isPreEmptible ? 32 : 64,
}

if (process.env.ALLOWED_COMPILE_GROUPS) {
  try {
    module.exports.allowedCompileGroups =
      process.env.ALLOWED_COMPILE_GROUPS.split(' ')
  } catch (error) {
    console.error(error, 'could not apply allowed compile group setting')
    process.exit(1)
  }
}

if (process.env.DOCKER_RUNNER) {
  let seccompProfilePath
  module.exports.clsi = {
    dockerRunner: process.env.DOCKER_RUNNER === 'true',
    docker: {
      runtime: process.env.DOCKER_RUNTIME,
      image:
        process.env.TEXLIVE_IMAGE || 'quay.io/sharelatex/texlive-full:2017.1',
      env: {
        HOME: '/tmp',
        CLSI: 1,
      },
      socketPath: '/var/run/docker.sock',
      user: process.env.TEXLIVE_IMAGE_USER || 'tex',
    },
    optimiseInDocker: true,
    expireProjectAfterIdleMs: 24 * 60 * 60 * 1000,
    checkProjectsIntervalMs: 10 * 60 * 1000,
  }

  try {
    // Override individual docker settings using path-based keys, e.g.:
    // compileGroupDockerConfigs = {
    //    priority: { 'HostConfig.CpuShares': 100 }
    //    beta: { 'dotted.path.here', 'value'}
    // }
    const compileGroupConfig = JSON.parse(
      process.env.COMPILE_GROUP_DOCKER_CONFIGS || '{}'
    )
    // Automatically clean up wordcount and synctex containers
    const defaultCompileGroupConfig = {
      wordcount: { 'HostConfig.AutoRemove': true },
      synctex: { 'HostConfig.AutoRemove': true },
    }
    module.exports.clsi.docker.compileGroupConfig = Object.assign(
      defaultCompileGroupConfig,
      compileGroupConfig
    )
  } catch (error) {
    console.error(error, 'could not apply compile group docker configs')
    process.exit(1)
  }

  try {
    seccompProfilePath = Path.resolve(__dirname, '../seccomp/clsi-profile.json')
    module.exports.clsi.docker.seccomp_profile = JSON.stringify(
      JSON.parse(require('node:fs').readFileSync(seccompProfilePath))
    )
  } catch (error) {
    console.error(
      error,
      `could not load seccomp profile from ${seccompProfilePath}`
    )
    process.exit(1)
  }

  if (process.env.APPARMOR_PROFILE) {
    try {
      module.exports.clsi.docker.apparmor_profile = process.env.APPARMOR_PROFILE
    } catch (error) {
      console.error(error, 'could not apply apparmor profile setting')
      process.exit(1)
    }
  }

  if (process.env.ALLOWED_IMAGES) {
    try {
      module.exports.clsi.docker.allowedImages =
        process.env.ALLOWED_IMAGES.split(' ')
    } catch (error) {
      console.error(error, 'could not apply allowed images setting')
      process.exit(1)
    }
  }

  module.exports.path.synctexBaseDir = () => '/compile'

  module.exports.path.sandboxedCompilesHostDir = process.env.COMPILES_HOST_DIR
}
