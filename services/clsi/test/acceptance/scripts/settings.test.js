const Path = require('path')

module.exports = {
  // Options are passed to Sequelize.
  // See http://sequelizejs.com/documentation#usage-options for details
  mysql: {
    clsi: {
      database: 'clsi',
      username: 'clsi',
      password: null,
      dialect: 'sqlite',
      storage: Path.resolve('db.sqlite'),
    },
  },

  path: {
    // eslint-disable-next-line no-path-concat
    compilesDir: Path.resolve(__dirname + '/../../../compiles'),
    // eslint-disable-next-line no-path-concat
    clsiCacheDir: Path.resolve(__dirname + '/../../../cache'),
    // synctexBaseDir: (project_id) -> Path.join(@compilesDir, project_id)
    synctexBaseDir() {
      return '/compile'
    },
    sandboxedCompilesHostDir: process.env.SANDBOXED_COMPILES_HOST_DIR,
  },

  clsi: {
    // strace: true
    // archive_logs: true
    commandRunner: 'docker-runner-sharelatex',
    latexmkCommandPrefix: ['/usr/bin/time', '-v'], // on Linux
    docker: {
      image: process.env.TEXLIVE_IMAGE || 'texlive-full:2017.1-opt',
      env: {
        PATH:
          '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/local/texlive/2017/bin/x86_64-linux/',
        HOME: '/tmp',
      },
      modem: {
        socketPath: false,
      },
      user: process.env.SIBLING_CONTAINER_USER || '111',
    },
  },

  internal: {
    clsi: {
      port: 3013,
      load_port: 3044,
      host: 'localhost',
    },
  },

  apis: {
    clsi: {
      url: 'http://localhost:3013',
    },
  },

  smokeTest: false,
  project_cache_length_ms: 1000 * 60 * 60 * 24,
  parallelFileDownloads: 1,
}
