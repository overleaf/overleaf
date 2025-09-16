import minimist from 'minimist'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import Runner from 'jscodeshift/src/Runner.js'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// use minimist to get a list of files from the argv
const {
  dryRun,
  verbose,
  usage,
  _: files,
} = minimist(process.argv.slice(2), {
  boolean: ['dryRun', 'usage', 'verbose'],
})

function printUsage() {
  console.log(
    'node scripts/vitest/mocha-to-vitest.mjs [files] [--dryRun] [--format] [--lint] [--usage] [--verbose]'
  )
  console.log(
    'WARNING: this will only work in local development as important dependencies will be missing in production'
  )
  console.log('Options:')
  console.log('   files: a list of files to convert')
  console.log('--dryRun: do not actually run the commands, just print them')
  console.log('--format: run prettier to fix formatting')
  console.log('  --lint: run eslint to fix linting')
  console.log(' --usage: show this help message')
  console.log('--verbose: enable verbose output')
  process.exit(0)
}

if (usage) {
  printUsage()
}

if (!Array.isArray(files) || files.length === 0) {
  console.error('You must provide a list of files to convert')
  printUsage()
  process.exit(1)
}

const promisifiedExec = promisify(exec)

const transforms = [
  './codemods/replaceDoneWithPromise.js',
  './codemods/convertThisToCtx.js',
  './codemods/replaceSandboxedModuleWithDoMock.js',
  './codemods/replaceDirectChaiUsage.js',
]

const config = {
  output: import.meta.dirname,
  silent: verbose,
  print: false,
  verbose: verbose ? 1 : 0,
  hoist: true,
  dry: dryRun,
  runInBand: true,
}

if (dryRun) {
  console.log('Dry run mode enabled. No changes will be made.')
}

for (const transformPath of transforms) {
  if (verbose) {
    console.log(`Running transform: ${transformPath}`)
  }
  const transform = fileURLToPath(await import.meta.resolve(transformPath))
  await Runner.run(transform, files, config)
}

const webRoot = fileURLToPath(new URL('../../', import.meta.url))

if (!dryRun) {
  for (const file of files) {
    // move files with git mv
    const newFileName = file
      .replace('Tests.mjs', '.test.mjs')
      .replace('Tests.js', '.test.js')
      .replace('Test.js', '.test.js')
      .replace('Test.mjs', '.test.mjs')

    await promisifiedExec(`git mv ${file} ${newFileName}`)
    const relativePath = path.relative(webRoot, file)
    console.log(`transformed ${relativePath} and renamed it for vitest`)
  }
}
