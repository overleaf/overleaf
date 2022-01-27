const services = require('./services')

console.log('#!/bin/bash')
console.log('set -ex')

switch (process.argv.pop()) {
  case 'install':
    for (const service of services) {
      console.log('pushd', service.name)
      switch (service.name) {
        case 'web':
          console.log('npm ci')
          break
        case 'docstore':
        case 'filestore':
          console.log('npm ci --unsafe-perm')
          break
        default:
          // TODO(das7pad): revert back to npm ci --only=production (https://github.com/overleaf/issues/issues/4544)
          console.log('npm ci')
      }
      console.log('popd')
    }
  case 'compile':
    for (const service of services) {
      console.log('pushd', `services/${service.name}`)
      switch (service.name) {
        case 'web':
          console.log('npm run webpack:production')
          // drop webpack/babel cache
          console.log('rm -rf node_modules/.cache')
          break
        default:
          console.log(`echo ${service.name} does not require a compilation`)
      }
      console.log('popd')
    }
    break
  default:
    console.error('unknown command')
    console.log('exit 101')
    process.exit(101)
}

console.log('set +x')
console.log(
  'rm -rf /root/.cache /root/.npm $(find /tmp/ -mindepth 1 -maxdepth 1)'
)
