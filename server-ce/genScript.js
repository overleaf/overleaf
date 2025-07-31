const services = require('./services')

console.log('#!/bin/bash')
console.log('set -ex')

switch (process.argv.pop()) {
  case 'install':
    console.log('npm install --omit=dev')
    break
  case 'compile':
    for (const service of services) {
      console.log('pushd', `services/${service.name}`)
      switch (service.name) {
        case 'web':
          // precompile pug in background
          console.log('npm run precompile-pug &')
          console.log('pug_precompile=$!')

          // Avoid downloading of cypress
          console.log('export CYPRESS_INSTALL_BINARY=0')

          // install webpack and frontend dependencies
          console.log('npm install --include=dev')
          // run webpack
          console.log('npm run webpack:production')
          // uninstall webpack and frontend dependencies
          console.log('npm prune --omit=dev')

          // Wait for pug precompile to finish
          console.log('wait "$pug_precompile"')
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
