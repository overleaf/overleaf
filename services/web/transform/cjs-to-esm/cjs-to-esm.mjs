import minimist from 'minimist'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import Runner from 'jscodeshift/src/Runner.js'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
// use minimist to get a list of files from the argv
const argv = minimist(process.argv.slice(2), {
  boolean: ['usage'],
})

function printUsage() {
  console.log(
    'node scripts/esm-migration/cjs-to-esm.mjs [files] [--format] [--lint] [--usage]'
  )
  console.log(
    'WARNING: this will only work in local development as important dependencies will be missing in production'
  )
  console.log('Options:')
  console.log('   files: a list of files to convert')
  console.log('--format: run prettier to fix formatting')
  console.log('  --lint: run eslint to fix linting')
  console.log(' --usage: show this help message')
  process.exit(0)
}

const files = argv._

if (argv.usage) {
  printUsage()
}

if (!Array.isArray(files) || files.length === 0) {
  console.error('You must provide a list of files to convert')
  printUsage()
  process.exit(1)
}

const promisifiedExec = promisify(exec)

const cjsTransform = fileURLToPath(
  import.meta.resolve('5to6-codemod/transforms/cjs.js')
)
const exportsTransform = fileURLToPath(
  import.meta.resolve('5to6-codemod/transforms/exports.js')
)
const overleafTransform = fileURLToPath(
  import.meta.resolve('./overleaf-es-codemod.js')
)

const config = {
  output: __dirname,
  silent: true,
  print: false,
  verbose: 0,
  hoist: true,
}

await Runner.run(cjsTransform, files, config)
await Runner.run(exportsTransform, files, config)
await Runner.run(overleafTransform, files, config)

const webRoot = fileURLToPath(new URL('../../', import.meta.url))

for (const file of files) {
  // move files with git mv
  await promisifiedExec(`git mv ${file} ${file.replace('.js', '.mjs')}`)
  const relativePath = path.relative(webRoot, file)
  console.log(
    `transformed ${relativePath} and renamed it to have a .mjs extension`
  )
}
