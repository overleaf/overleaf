import fs from 'node:fs'
import path from 'node:path'
import minimist from 'minimist'

const APP_CODE_PATH = ['app', 'modules', 'scripts', 'test']

// These have already been converted but don't have a `.mjs` extension
const converted = new Set([
  'scripts/ukamf/check-certs.js',
  'scripts/ukamf/check-idp-metadata.js',
  'scripts/ukamf/metadata-processor.js',
  'scripts/ukamf/ukamf-db.js',
  'scripts/ukamf/ukamf-entity.js',
  'scripts/translations/checkCoverage.js',
  'scripts/translations/checkSanitizeOptions.js',
  'scripts/translations/checkVariables.js',
  'scripts/translations/cleanupUnusedLocales.js',
  'scripts/translations/config.js',
  'scripts/translations/download.js',
  'scripts/translations/insertHTMLFragments.js',
  'scripts/translations/replaceLinkFragments.js',
  'scripts/translations/sanitize.js',
  'scripts/translations/sort.js',
  'scripts/translations/transformLocales.js',
  'scripts/translations/translateLocales.js',
  'scripts/translations/upload.js',
  'scripts/translations/uploadNonEnglish.js',
  'scripts/translations/utils.js',
])
// These files are not to be converted (e.g. they use CommonJS features that are not available in ES Modules)
const excluded = new Set([
  'modules/server-ce-scripts/scripts/create-user.js', // must be CJS for backwards compatibility
  'test/acceptance/config/settings.test.saas.js', // must be CJS for @overleaf/settings module
  'test/acceptance/config/settings.test.server-pro.js', // must be CJS for @overleaf/settings module
  'app/src/infrastructure/PackageVersions.js', // required by webpack
])

function fileIsESM(file) {
  const relativePath = file.replace(process.cwd() + '/', '')
  return file.endsWith('.mjs') || converted.has(relativePath)
}

function fileCanBeConvertedToESM(file) {
  const relativePath = file.replace(process.cwd() + '/', '')
  if (fileIsESM(relativePath)) {
    return false
  }
  return !excluded.has(relativePath)
}

const {
  _: args,
  files,
  help,
  json,
} = minimist(process.argv.slice(2), {
  boolean: ['files', 'help', 'json'],
  alias: {
    files: 'f',
    help: 'h',
    json: 'j',
  },
  default: {
    files: false,
    help: false,
    json: false,
  },
})
const paths = args.length > 0 ? args : APP_CODE_PATH

function usage() {
  console.error(`Usage: node check-esm-migration.js [OPTS...] dir1 dir2
       node check-esm-migration.js file

Usage with directories
----------------------

When the arguments are a list of directories it prints the status of ES Modules migration within those directories.
When no directory is provided, it checks app/ and modules/, which represent the entire codebase.

With the --files (-f) option, it prints the list of JS files that:
 - Are not migrated to ESM
 - Are not required by any file that is not migrated yet to ESM (in the entire codebase)

These files should be the most immediate candidates to be migrated.

WARNING: please note that this script only looks up literals in require() statements, so paths
built dynamically (such as those in infrastructure/Modules.js) are not being taken into account.

Usage with a JS file
--------------------

When the argument is a JS file, the script outputs the files that depend on this file that have not been converted
yet to ES Modules.

The files in the list must to be converted to ES Modules before converting the JS file.

Example:
   node scrips/check-esm-migration.js --files modules/admin-panel
   node scrips/check-esm-migration.js app/src/router.js

Options:
    --files      Prints the files that are not imported by app code via CommonJS
    --json       Prints the result in JSON format, including the list of files from --files
    --help       Prints this help
`)
}

function resolveImportPaths(dir, file) {
  const absolutePath = path.resolve(dir, file)
  if (fs.existsSync(absolutePath)) {
    return absolutePath
  } else if (fs.existsSync(absolutePath + '.js')) {
    return absolutePath + '.js'
  } else if (fs.existsSync(absolutePath + '.mjs')) {
    return absolutePath + '.mjs'
  } else {
    return null
  }
}

function collectJsFiles(dir, files = []) {
  const items = fs.readdirSync(dir)
  items.forEach(item => {
    const fullPath = path.join(dir, item)
    const stat = fs.statSync(fullPath)

    if (stat.isDirectory()) {
      const basename = path.basename(fullPath)

      // skipping directories from search
      if (!['frontend', 'node_modules'].includes(basename)) {
        collectJsFiles(fullPath, files)
      }
    } else if (
      stat.isFile() &&
      (fullPath.endsWith('.js') || fullPath.endsWith('.mjs'))
    ) {
      files.push(fullPath)
    }
  })
  return files
}

function extractImports(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf-8')

  // not 100% compliant (string escaping, etc.) but does the work here
  const contentWithoutComments = fileContent.replace(
    /\/\/.*|\/\*[\s\S]*?\*\//g,
    ''
  )

  const requireRegex = /require\s*\(\s*['"](.+?)['"]\s*\)/g

  const dependencies = []
  while (true) {
    const match = requireRegex.exec(contentWithoutComments)
    if (!match) {
      break
    }
    dependencies.push(match[1])
  }

  // build absolute path for the imported file
  return dependencies
    .map(depPath => resolveImportPaths(path.dirname(filePath), depPath))
    .filter(path => path !== null)
}

// Main function to process a list of directories and create the Map of dependencies
function findJSAndImports(directories) {
  const fileDependenciesMap = new Map()

  directories.forEach(dir => {
    if (fs.existsSync(dir)) {
      const jsFiles = collectJsFiles(dir)

      jsFiles.forEach(filePath => {
        const imports = extractImports(filePath)
        fileDependenciesMap.set(filePath, imports)
      })
    } else {
      console.error(`Directory not found: ${dir}`)
      process.exit(1)
    }
  })

  return fileDependenciesMap
}

function printDirectoriesReport(allFilesAndImports) {
  // collect all files that are imported via CommonJS in the entire backend codebase
  const filesImportedViaCjs = new Set()
  allFilesAndImports.forEach((imports, file) => {
    if (!fileIsESM(file)) {
      imports.forEach(imprt => filesImportedViaCjs.add(imprt))
    }
  })

  // collect js files from the selected paths
  const selectedFiles = Array.from(
    findJSAndImports(paths.map(dir => path.resolve(dir))).keys()
  ).filter(file => !file.endsWith('settings.test.js'))
  const nonMigratedFiles = selectedFiles.filter(fileCanBeConvertedToESM)
  const migratedFileCount = selectedFiles.filter(fileIsESM).length

  // collect files in the selected paths that are not imported via CommonJs in the entire backend codebase
  const filesNotImportedViaCjs = nonMigratedFiles.filter(
    file => !filesImportedViaCjs.has(file)
  )

  if (json) {
    console.log(
      JSON.stringify(
        {
          fileCount: selectedFiles.length,
          migratedFileCount,
          filesNotImportedViaCjs,
        },
        null,
        2
      )
    )
  } else {
    console.log(`Found ${selectedFiles.length} files in ${paths}:
    - ${migratedFileCount} have been migrated to ES Modules (progress=${((migratedFileCount / selectedFiles.length) * 100).toFixed(2)}%)
    - ${filesNotImportedViaCjs.length} are ready to migrate (these are not imported via CommonJS in the entire codebase)
`)
    if (files) {
      console.log(`Files that are ready to migrate:`)
      filesNotImportedViaCjs.forEach(file =>
        console.log(`    - ${file.replace(process.cwd() + '/', '')}`)
      )
    }
  }
}

function printFileReport(allFilesAndImports) {
  const filePath = path.resolve(paths[0])
  if (fileIsESM(filePath)) {
    console.log(`${filePath} is already migrated to ESM`)
    return
  }
  const filePathWithoutExtension = filePath.replace('.js', '')

  const importingFiles = []
  allFilesAndImports.forEach((imports, file) => {
    if (fileIsESM(file)) {
      return
    }
    if (
      imports.some(
        imprt => imprt === filePath || imprt === filePathWithoutExtension
      )
    ) {
      importingFiles.push(file)
    }
  })

  if (json) {
    console.log(
      JSON.stringify(
        {
          importingFiles,
        },
        null,
        2
      )
    )
  } else {
    console.log(`${filePath} is required by ${importingFiles.length} CJS file`)
    importingFiles.forEach(file =>
      console.log(`    - ${file.replace(process.cwd() + '/', '')}`)
    )
  }
}

function main() {
  if (help) {
    usage()
    process.exit(0)
  }

  // collect all the js files in the entire backend codebase (app/ + modules/) with its imports
  const allFilesAndImports = findJSAndImports(
    APP_CODE_PATH.map(dir => path.resolve(dir))
  )
  const entryPoint = fs.existsSync('app.js') ? 'app.js' : 'app.mjs'
  allFilesAndImports.set(path.resolve(entryPoint), extractImports(entryPoint))

  const isFileReport = fs.statSync(paths[0]).isFile()

  if (isFileReport) {
    printFileReport(allFilesAndImports)
  } else {
    printDirectoriesReport(allFilesAndImports)
  }
}

main()
