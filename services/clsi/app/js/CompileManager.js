const fsPromises = require('node:fs/promises')
const os = require('node:os')
const Path = require('node:path')
const { callbackify, promisify } = require('node:util')
const { execFile } = require('node:child_process')

const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
const OError = require('@overleaf/o-error')

const ResourceWriter = require('./ResourceWriter')
const LatexRunner = require('./LatexRunner')
const OutputFileFinder = require('./OutputFileFinder')
const OutputCacheManager = require('./OutputCacheManager')
const ClsiMetrics = require('./Metrics')
const DraftModeManager = require('./DraftModeManager')
const TikzManager = require('./TikzManager')
const LockManager = require('./LockManager')
const Errors = require('./Errors')
const CommandRunner = require('./CommandRunner')
const ContentCacheMetrics = require('./ContentCacheMetrics')
const SynctexOutputParser = require('./SynctexOutputParser')
const CLSICacheHandler = require('./CLSICacheHandler')
const StatsManager = require('./StatsManager')
const SafeReader = require('./SafeReader')
const LatexMetrics = require('./LatexMetrics')
const { callbackifyMultiResult } = require('@overleaf/promise-utils')

const { downloadLatestCompileCache, downloadOutputDotSynctexFromCompileCache } =
  CLSICacheHandler
const { emitPdfStats } = ContentCacheMetrics
const { enableLatexMkMetrics, addLatexFdbMetrics } = LatexMetrics

const KNOWN_LATEXMK_RULES = new Set([
  'biber',
  'bibtex',
  'dvipdf',
  'latex',
  'lualatex',
  'makeindex',
  'pdflatex',
  'xdvipdfmx',
  'xelatex',
])

const LATEX_PASSES_RULES = new Set(['latex', 'lualatex', 'xelatex', 'pdflatex'])

const execFilePromise = promisify(execFile)

// Regex patterns for detecting missing LaTeX packages in compilation output
const MISSING_FILE_PATTERNS = [
  /^! LaTeX Error: File `([^']+\.\w+)' not found/gm,
  /^! I can't find file `([^']+)'/gm,
  /^LaTeX Error: File `([^']+\.\w+)' not found/gm,
  /^Package inputenc Error:.*`([^']+)' not found/gm,
]

// Matches: ! Package babel Error: Unknown option 'ngerman'.
const BABEL_UNKNOWN_LANG_PATTERN =
  /Package babel Error: Unknown option '([a-zA-Z]+)'/gm

// Matches tikz library not found errors
const TIKZ_LIBRARY_PATTERN =
  /^! Package tikz Error: I did not find the tikz library '([^']+)'/gm

// Matches packages that fatally error at load time (e.g. bidi requires XeTeX)
const FATAL_PACKAGE_PATTERN =
  /^! Fatal Package (\w+) Error:/gm

// Persistent stub directory in texmf-local (survives across compiles)
const PERSISTENT_STUB_DIR = '/usr/local/texlive/texmf-local/tex/latex/auto-stubs'

// Core LaTeX packages that must NEVER be stubbed — they're part of the base
// TeX Live installation and stubbing them breaks fundamental functionality.
const NEVER_STUB_PACKAGES = new Set([
  'fontenc', 'inputenc', 'babel', 'amsmath', 'amssymb', 'amsfonts',
  'graphicx', 'graphics', 'color', 'xcolor', 'hyperref', 'geometry',
  'fancyhdr', 'enumitem', 'booktabs', 'array', 'tabularx', 'longtable',
  'xkeyval', 'keyval', 'xparse', 'l3keys2e', 'expl3', 'l3packages',
  'pgf', 'tikz', 'pgfcore', 'pgfplots', 'calc', 'ifthen', 'etoolbox',
  'kvoptions', 'kvsetkeys', 'kvdefinekeys', 'pdftexcmds', 'infwarerr',
  'textcomp', 'fix-cm', 'lmodern', 'fontspec', 'unicode-math',
  'natbib', 'biblatex', 'csquotes', 'url', 'microtype', 'parskip',
  'setspace', 'caption', 'subcaption', 'float', 'wrapfig',
  'textpos', 'listings', 'verbatim', 'fancyvrb', 'tcolorbox',
  'multicol', 'multirow', 'makeidx', 'tocbibind', 'tocloft',
  'titlesec', 'titletoc', 'appendix', 'pdfpages',
])

/**
 * Remove persistent stubs for packages that now have real .sty files
 * available in the TeX distribution (not our stub directory).
 */
async function _cleanupStalePersistentStubs() {
  let files
  try {
    files = await fsPromises.readdir(PERSISTENT_STUB_DIR)
  } catch {
    return // stub directory doesn't exist yet
  }
  for (const file of files) {
    if (!file.endsWith('.sty')) continue
    try {
      const { stdout } = await execFilePromise('kpsewhich', ['-all', file])
      const paths = stdout.trim().split('\n').filter(p => p.trim())
      // If any path is NOT in our auto-stubs directory, a real package exists
      const hasReal = paths.some(p => !p.includes('auto-stubs'))
      if (hasReal) {
        await fsPromises.unlink(Path.join(PERSISTENT_STUB_DIR, file))
        logger.info({ file }, 'auto-install: removed stale stub (real package now available)')
      }
    } catch {
      // kpsewhich failed, package not available, keep stub
    }
  }
}

/**
 * Remove persistent stub for a specific package if it exists.
 */
async function _removePersistentStub(pkg) {
  try {
    await fsPromises.unlink(Path.join(PERSISTENT_STUB_DIR, `${pkg}.sty`))
  } catch {
    // stub didn't exist or already removed
  }
}

/**
 * Find the correct TeX Live package name for a given .sty file using tlmgr search.
 * Returns the package name if found, or null.
 */
async function _findTlmgrPackageName(styFile) {
  try {
    const { stdout } = await execFilePromise('tlmgr', [
      'search', '--global', '--file', `/${styFile}`,
    ], { timeout: 30000 })
    const pkgMatch = stdout.match(/^(\S+):$/m)
    return pkgMatch ? pkgMatch[1] : null
  } catch {
    return null
  }
}

/**
 * Pre-install step: scan .tex source files for \usepackage and \RequirePackage,
 * batch-check availability with kpsewhich, and install/stub everything upfront
 * BEFORE compilation even starts. This avoids the slow one-at-a-time loop.
 */
async function _preInstallFromSource(compileDir, mainFile, projectId) {
  const texPath = Path.join(compileDir, mainFile)
  let texContent
  try {
    texContent = await fsPromises.readFile(texPath, 'utf-8')
  } catch {
    return
  }

  // Extract all \usepackage{...} and \RequirePackage{...} (handles comma-separated)
  const packagePattern = /\\(?:usepackage|RequirePackage)(?:\s*\[[^\]]*\])?\s*\{([^}]+)\}/g
  const packages = new Set()
  let m
  while ((m = packagePattern.exec(texContent)) !== null) {
    for (const pkg of m[1].split(',')) {
      const name = pkg.trim()
      if (name) packages.add(name)
    }
  }

  if (packages.size === 0) return

  // Clean up any stale persistent stubs before checking availability
  await _cleanupStalePersistentStubs()

  // Batch-check which packages are missing
  const missing = []
  for (const pkg of packages) {
    try {
      const { stdout } = await execFilePromise('kpsewhich', [`${pkg}.sty`])
      if (stdout.trim()) {
        // Found — but make sure it's not one of our stubs shadowing nothing
        const foundPath = stdout.trim()
        if (foundPath.includes('auto-stubs')) {
          // Check if a real version exists too
          try {
            const { stdout: allPaths } = await execFilePromise('kpsewhich', ['-all', `${pkg}.sty`])
            const hasReal = allPaths.trim().split('\n').some(p => p.trim() && !p.includes('auto-stubs'))
            if (hasReal) {
              // Real package exists, remove the stale stub
              await _removePersistentStub(pkg)
              continue
            }
          } catch {
            // fall through to treat as missing
          }
          // Only our stub exists — still "missing" from TeX Live
          // but don't re-install if we already know it's unresolvable
          continue
        }
        continue // genuinely available
      }
    } catch {
      // kpsewhich failed = not found
    }
    missing.push(pkg)
  }

  if (missing.length === 0) return

  logger.info(
    { projectId, count: missing.length, packages: missing.slice(0, 20) },
    'auto-install: pre-scan found missing packages, batch-installing'
  )

  const toStub = []
  let anyInstalled = false

  // Batch install all missing packages using proper tlmgr search
  for (const pkg of missing) {
    const styFile = `${pkg}.sty`

    // First try: find the real TeX Live package name via tlmgr search
    let packageName = await _findTlmgrPackageName(styFile)

    // Second try: use the package name directly (sometimes they match)
    if (!packageName) {
      packageName = pkg
    }

    try {
      await execFilePromise('tlmgr', ['install', packageName], { timeout: 120000 })
      // Verify it actually provides the .sty after install
      try {
        const { stdout } = await execFilePromise('kpsewhich', [styFile])
        if (stdout.trim() && !stdout.trim().includes('auto-stubs')) {
          anyInstalled = true
          // Remove any stale persistent stub for this package
          await _removePersistentStub(pkg)
          continue
        }
      } catch {
        // kpsewhich failed after install
      }
    } catch {
      // tlmgr install failed
    }

    // If we also tried the direct name and it differed, try that too
    if (packageName !== pkg) {
      try {
        await execFilePromise('tlmgr', ['install', pkg], { timeout: 120000 })
        try {
          const { stdout } = await execFilePromise('kpsewhich', [styFile])
          if (stdout.trim() && !stdout.trim().includes('auto-stubs')) {
            anyInstalled = true
            await _removePersistentStub(pkg)
            continue
          }
        } catch {
          // still not found
        }
      } catch {
        // direct install also failed
      }
    }

    // Only stub if NOT a core package
    if (!NEVER_STUB_PACKAGES.has(pkg)) {
      toStub.push(pkg)
    } else {
      logger.warn(
        { pkg, projectId },
        'auto-install: refusing to stub core package — it should be part of base TeX Live'
      )
    }
  }

  // Create persistent stubs ONLY for truly unresolvable non-core packages
  if (toStub.length > 0) {
    try {
      await fsPromises.mkdir(PERSISTENT_STUB_DIR, { recursive: true })
    } catch {
      // directory may already exist
    }
    for (const pkg of toStub) {
      try {
        const stubPath = Path.join(PERSISTENT_STUB_DIR, `${pkg}.sty`)
        await fsPromises.writeFile(
          stubPath,
          `\\ProvidesPackage{${pkg}}%% auto-install stub\n`
        )
      } catch {
        // ignore individual stub failures
      }
    }
    try {
      await execFilePromise('texhash', [], { timeout: 60000 })
    } catch {
      // texhash failure is non-critical
    }
    logger.info(
      { projectId, stubbed: toStub },
      'auto-install: pre-scan created persistent stubs'
    )
  }

  // texhash for any successfully installed packages
  if (anyInstalled) {
    try {
      await execFilePromise('texhash', [], { timeout: 60000 })
    } catch {
      // non-critical
    }
    // Clean up any stubs that are now shadowing real packages
    await _cleanupStalePersistentStubs()
    try {
      await execFilePromise('texhash', [], { timeout: 60000 })
    } catch {
      // non-critical
    }
    logger.info(
      { projectId, installed: missing.length - toStub.length },
      'auto-install: pre-scan installed packages'
    )
  }
}

/**
 * Parse output.log for missing LaTeX packages/files.
 * Returns { missingFiles, missingBabelLangs, missingTikzLibs, fatalPackages }
 */
async function _parseMissingPackages(compileDir) {
  const logPath = Path.join(compileDir, 'output.log')
  let logContent
  try {
    logContent = await fsPromises.readFile(logPath, 'utf-8')
  } catch {
    return { missingFiles: [], missingBabelLangs: [], missingTikzLibs: [], fatalPackages: [] }
  }

  const missingFiles = new Set()
  for (const pattern of MISSING_FILE_PATTERNS) {
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(logContent)) !== null) {
      missingFiles.add(match[1])
    }
  }

  const missingBabelLangs = new Set()
  BABEL_UNKNOWN_LANG_PATTERN.lastIndex = 0
  let match
  while ((match = BABEL_UNKNOWN_LANG_PATTERN.exec(logContent)) !== null) {
    missingBabelLangs.add(match[1])
  }

  const missingTikzLibs = new Set()
  TIKZ_LIBRARY_PATTERN.lastIndex = 0
  while ((match = TIKZ_LIBRARY_PATTERN.exec(logContent)) !== null) {
    missingTikzLibs.add(match[1])
  }

  const fatalPackages = new Set()
  FATAL_PACKAGE_PATTERN.lastIndex = 0
  while ((match = FATAL_PACKAGE_PATTERN.exec(logContent)) !== null) {
    fatalPackages.add(match[1])
  }

  // Detect packages that cause emergency stops (e.g. packages requiring
  // interactive terminal input like eemeir, which cannot work in nonstop mode).
  const emergencyStopPattern = /^! Emergency stop\./gm
  let emMatch
  while ((emMatch = emergencyStopPattern.exec(logContent)) !== null) {
    const beforeText = logContent.slice(
      Math.max(0, emMatch.index - 5000),
      emMatch.index
    )
    const pkgMatches = [...beforeText.matchAll(/^Package:\s+([\w-]+)\s/gm)]
    if (pkgMatches.length > 0) {
      fatalPackages.add(pkgMatches[pkgMatches.length - 1][1])
    }
  }

  // Generic fallback: if the compilation produced a fatal error but none of
  // the specific patterns above found anything, identify the last package
  // that was being loaded when the error occurred and flag it for stubbing.
  if (
    missingFiles.size === 0 &&
    missingBabelLangs.size === 0 &&
    missingTikzLibs.size === 0 &&
    fatalPackages.size === 0
  ) {
    const fatalMatch = logContent.match(
      /^!\s+==> Fatal error occurred, no output PDF file produced!/m
    )
    if (fatalMatch) {
      const beforeFatal = logContent.slice(
        Math.max(0, fatalMatch.index - 10000),
        fatalMatch.index
      )
      const pkgMatches = [...beforeFatal.matchAll(/^Package:\s+([\w-]+)\s/gm)]
      if (pkgMatches.length > 0) {
        const lastPkg = pkgMatches[pkgMatches.length - 1][1]
        fatalPackages.add(lastPkg)
        logger.info(
          { pkg: lastPkg },
          'auto-install: generic fallback identified failing package'
        )
      }
    }
  }

  return {
    missingFiles: Array.from(missingFiles),
    missingBabelLangs: Array.from(missingBabelLangs),
    missingTikzLibs: Array.from(missingTikzLibs),
    fatalPackages: Array.from(fatalPackages),
  }
}

/**
 * Create a persistent stub for a package in texmf-local so it survives
 * across compiles. Also creates a copy in compileDir for immediate use.
 */
async function _createPersistentStub(pkg, compileDir, projectId) {
  const fname = `${pkg}.sty`
  // Write to persistent texmf-local directory
  try {
    await fsPromises.mkdir(PERSISTENT_STUB_DIR, { recursive: true })
    const persistentPath = Path.join(PERSISTENT_STUB_DIR, fname)
    await fsPromises.writeFile(
      persistentPath,
      `\\ProvidesPackage{${pkg}}%% auto-install stub\n`
    )
  } catch (err) {
    logger.warn({ err, pkg, projectId }, 'auto-install: failed to create persistent stub')
  }
  // Also write to compileDir for immediate use (before texhash runs)
  try {
    const localPath = Path.join(compileDir, fname)
    await fsPromises.writeFile(
      localPath,
      `\\ProvidesPackage{${pkg}}%% auto-install stub\n`
    )
  } catch {
    // non-critical
  }
}

/**
 * Attempt to install missing LaTeX packages using tlmgr.
 * Returns { installed: string[], unresolvable: string[] }.
 */
async function _autoInstallPackages({ missingFiles, missingBabelLangs, missingTikzLibs }, projectId) {
  const installed = []
  const unresolvable = []

  for (const lib of missingTikzLibs) {
    try {
      logger.info({ lib, projectId }, 'auto-install: installing tikz library')
      await execFilePromise('tlmgr', ['install', lib], { timeout: 120000 })
      installed.push(lib)
    } catch (err) {
      logger.warn({ err, lib, projectId }, 'auto-install: failed to install tikz library')
    }
  }

  for (const file of missingFiles) {
    try {
      const { stdout: searchResult } = await execFilePromise('tlmgr', [
        'search', '--global', '--file', `/${file}`,
      ])
      const pkgMatch = searchResult.match(/^(\S+):$/m)
      let packageName
      if (!pkgMatch) {
        packageName = file.replace(/\.\w+$/, '')
        logger.warn(
          { file, packageName, projectId },
          'auto-install: tlmgr search found nothing, trying direct install'
        )
      } else {
        packageName = pkgMatch[1]
      }
      logger.info({ file, packageName, projectId }, 'auto-install: installing package')
      await execFilePromise('tlmgr', ['install', packageName], { timeout: 120000 })
      try {
        const { stdout: found } = await execFilePromise('kpsewhich', [file])
        if (found.trim()) {
          installed.push(packageName)
        } else {
          unresolvable.push(file)
        }
      } catch {
        unresolvable.push(file)
      }
    } catch (err) {
      logger.warn({ err, file, projectId }, 'auto-install: failed to install package')
      unresolvable.push(file)
    }
  }

  for (const lang of missingBabelLangs) {
    const packageName = `babel-${lang}`
    try {
      logger.info({ lang, packageName, projectId }, 'auto-install: installing babel language')
      await execFilePromise('tlmgr', ['install', packageName], { timeout: 120000 })
      installed.push(packageName)
    } catch (err) {
      logger.warn({ err, lang, packageName, projectId }, 'auto-install: failed to install babel language')
    }
  }

  if (installed.length > 0) {
    try {
      await execFilePromise('texhash', [], { timeout: 60000 })
    } catch (err) {
      logger.warn({ err, projectId }, 'auto-install: texhash failed')
    }
  }

  return { installed, unresolvable }
}

function getCompileName(projectId, userId) {
  if (userId != null) {
    return `${projectId}-${userId}`
  } else {
    return projectId
  }
}

function getCompileDir(projectId, userId) {
  return Path.join(Settings.path.compilesDir, getCompileName(projectId, userId))
}

function getOutputDir(projectId, userId) {
  return Path.join(Settings.path.outputDir, getCompileName(projectId, userId))
}

async function doCompileWithLock(request, stats, timings) {
  const compileDir = getCompileDir(request.project_id, request.user_id)
  request.isInitialCompile =
    (await fsPromises.mkdir(compileDir, { recursive: true })) === compileDir
  // prevent simultaneous compiles
  const lock = LockManager.acquire(compileDir)
  try {
    return await doCompile(request, stats, timings)
  } finally {
    lock.release()
  }
}

async function doCompile(request, stats, timings) {
  const { project_id: projectId, user_id: userId } = request
  const compileDir = getCompileDir(request.project_id, request.user_id)

  const e2eCompileStart = Date.now()

  if (request.isInitialCompile) {
    stats.isInitialCompile = 1
    request.metricsOpts.compile = 'initial'
    if (request.compileFromClsiCache) {
      try {
        if (await downloadLatestCompileCache(projectId, userId, compileDir)) {
          stats.restoredClsiCache = 1
          request.metricsOpts.compile = 'from-clsi-cache'
        }
      } catch (err) {
        logger.warn(
          { err, projectId, userId },
          'failed to populate compile dir from cache'
        )
      }
    }
  } else {
    request.metricsOpts.compile = 'recompile'
  }

  const syncStart = Date.now()
  logger.debug(
    { projectId: request.project_id, userId: request.user_id },
    'syncing resources to disk'
  )

  let resourceList
  try {
    // NOTE: resourceList is insecure, it should only be used to exclude files from the output list
    resourceList = await ResourceWriter.promises.syncResourcesToDisk(
      request,
      compileDir
    )
  } catch (error) {
    if (error instanceof Errors.FilesOutOfSyncError) {
      OError.tag(error, 'files out of sync, please retry', {
        projectId: request.project_id,
        userId: request.user_id,
      })
    } else {
      OError.tag(error, 'error writing resources to disk', {
        projectId: request.project_id,
        userId: request.user_id,
      })
    }
    throw error
  }

  timings.sync = Date.now() - syncStart
  logger.debug(
    {
      projectId: request.project_id,
      userId: request.user_id,
      timeTaken: timings.sync,
    },
    'written files to disk'
  )

  // set up environment variables for chktex
  let env = {
    OVERLEAF_PROJECT_ID: request.project_id,
  }
  if (Settings.texliveOpenoutAny && Settings.texliveOpenoutAny !== '') {
    // override default texlive openout_any environment variable
    env.openout_any = Settings.texliveOpenoutAny
  }
  if (Settings.texliveMaxPrintLine && Settings.texliveMaxPrintLine !== '') {
    // override default texlive max_print_line environment variable
    env.max_print_line = Settings.texliveMaxPrintLine
  }
  // only run chktex on LaTeX files (not knitr .Rtex files or any others)
  const isLaTeXFile = request.rootResourcePath?.match(/\.tex$/i)
  if (request.check != null && isLaTeXFile) {
    env.CHKTEX_OPTIONS = '-nall -e9 -e10 -w15 -w16'
    env.CHKTEX_ULIMIT_OPTIONS = '-t 5 -v 64000'
    if (request.check === 'error') {
      env.CHKTEX_EXIT_ON_ERROR = 1
    }
    if (request.check === 'validate') {
      env.CHKTEX_VALIDATE = 1
    }
  }

  // the requested compile options may need a variant of the requested image,
  // which brings its own environment
  const imageVariantSettings = _getImageVariantSettings(request)
  request.imageName = imageVariantSettings.imageName
  env = { ...env, ...imageVariantSettings.env }

  const compileStart = Date.now()

  const compileName = getCompileName(request.project_id, request.user_id)

  // Record latexmk -time stats for a subset of users
  const recordPerformanceMetrics = StatsManager.sampleRequest(
    request,
    Settings.performanceLogSamplingPercentage
  )

  // Define a `latexmk` property on the stats object
  // to collect latexmk -time stats.
  try {
    enableLatexMkMetrics(stats)
  } catch {
    // Fallback if Object.defineProperty fails (e.g. base image version mismatch)
    if (!stats.latexmk) {
      stats.latexmk = {}
    }
  }

  try {
    const runLatexArgs = {
      directory: compileDir,
      mainFile: request.rootResourcePath,
      compiler: request.compiler,
      timeout: request.timeout,
      image: request.imageName,
      flags: request.flags,
      environment: env,
      compileGroup: request.compileGroup,
      stopOnFirstError: request.stopOnFirstError,
      stats,
      timings,
    }

    // Auto-install: pre-scan source files and batch-install before first compile
    if (Settings.autoInstallPackages) {
      await _preInstallFromSource(
        compileDir,
        request.rootResourcePath,
        request.project_id
      )
    }

    await LatexRunner.promises.runLatex(compileName, runLatexArgs)

    // Auto-install: retry loop for packages that couldn't be pre-installed
    // (dependencies, conditionally loaded packages, fatal errors, etc.)
    if (Settings.autoInstallPackages) {
      const alreadyAttempted = new Set()
      const stubFiles = new Set()
      let needsTexhash = false
      for (let attempt = 0; attempt < 100; attempt++) {
        if (!stats['latexmk-errors']) break
        const { missingFiles, missingBabelLangs, missingTikzLibs, fatalPackages } =
          await _parseMissingPackages(compileDir)
        const newFiles = missingFiles.filter(f => !alreadyAttempted.has(f))
        const newLangs = missingBabelLangs.filter(
          l => !alreadyAttempted.has(`babel-${l}`)
        )
        const newTikzLibs = missingTikzLibs.filter(
          l => !alreadyAttempted.has(`tikzlib-${l}`)
        )
        const newFatalPkgs = fatalPackages.filter(
          p => !alreadyAttempted.has(`fatal-${p}`)
        )
        if (
          newFiles.length === 0 &&
          newLangs.length === 0 &&
          newTikzLibs.length === 0 &&
          newFatalPkgs.length === 0
        ) break
        logger.info(
          {
            projectId: request.project_id,
            missingFiles: newFiles,
            missingBabelLangs: newLangs,
            missingTikzLibs: newTikzLibs,
            fatalPackages: newFatalPkgs,
            attempt,
          },
          'auto-install: detected missing packages, attempting install'
        )
        for (const f of newFiles) alreadyAttempted.add(f)
        for (const l of newLangs) alreadyAttempted.add(`babel-${l}`)
        for (const l of newTikzLibs) alreadyAttempted.add(`tikzlib-${l}`)
        for (const p of newFatalPkgs) alreadyAttempted.add(`fatal-${p}`)
        const { installed, unresolvable } = await _autoInstallPackages(
          { missingFiles: newFiles, missingBabelLangs: newLangs, missingTikzLibs: newTikzLibs },
          request.project_id
        )
        // After successful installs, remove any stubs that are now shadowed
        if (installed.length > 0) {
          needsTexhash = true
          try {
            await execFilePromise('texhash', [], { timeout: 60000 })
          } catch {
            // non-critical
          }
          await _cleanupStalePersistentStubs()
          // Also remove compile-dir stubs for installed packages
          for (const pkg of installed) {
            try {
              await fsPromises.unlink(Path.join(compileDir, `${pkg}.sty`))
            } catch {
              // may not exist
            }
          }
        }
        // Create persistent stubs for unresolvable .sty files (skip core packages)
        for (const f of unresolvable) {
          if (!f.endsWith('.sty')) continue
          const pkgName = f.replace(/\.sty$/, '')
          if (NEVER_STUB_PACKAGES.has(pkgName)) {
            logger.warn(
              { file: f, projectId: request.project_id },
              'auto-install: refusing to stub core package in retry loop'
            )
            continue
          }
          await _createPersistentStub(pkgName, compileDir, request.project_id)
          stubFiles.add(f)
          needsTexhash = true
          logger.info(
            { file: f, projectId: request.project_id },
            'auto-install: created persistent stub for unresolvable file'
          )
        }
        // Create persistent stubs for fatally-erroring packages (skip core packages)
        for (const pkg of newFatalPkgs) {
          const fname = `${pkg}.sty`
          if (stubFiles.has(fname)) continue
          if (NEVER_STUB_PACKAGES.has(pkg)) {
            logger.warn(
              { pkg, projectId: request.project_id },
              'auto-install: refusing to stub core package for fatal error'
            )
            continue
          }
          await _createPersistentStub(pkg, compileDir, request.project_id)
          stubFiles.add(fname)
          needsTexhash = true
          logger.info(
            { pkg, projectId: request.project_id },
            'auto-install: created persistent stub for fatally-erroring package'
          )
        }
        // Run texhash if we created any persistent stubs
        if (needsTexhash) {
          try {
            await execFilePromise('texhash', [], { timeout: 60000 })
          } catch {
            // non-critical
          }
          needsTexhash = false
        }
        const madeProgress =
          installed.length > 0 ||
          unresolvable.length > 0 ||
          newFatalPkgs.length > 0
        if (!madeProgress) break
        logger.info(
          { projectId: request.project_id, installed, stubbed: Array.from(stubFiles), attempt },
          'auto-install: retrying compilation'
        )
        await LatexRunner.promises.runLatex(compileName, runLatexArgs)
      }
      if (stubFiles.size > 0) {
        logger.info(
          { projectId: request.project_id, stubs: Array.from(stubFiles) },
          'auto-install: compile completed with stubs for unavailable packages'
        )
      }
    }

    // We use errors to return the validation state. It would be nice to use a
    // more appropriate mechanism.
    if (request.check === 'validate') {
      const validationError = new Error('validation')
      validationError.validate = 'pass'
      throw validationError
    }
  } catch (originalError) {
    let error = originalError
    // request was for validation only
    if (request.check === 'validate' && !error.validate) {
      error = new Error('validation')
      error.validate = originalError.code ? 'fail' : 'pass'
    }

    // request was for compile, and failed on validation
    if (request.check === 'error' && originalError.message === 'exited') {
      error = new Error('compilation')
      error.validate = 'fail'
    }

    const { outputFiles, allEntries, buildId } = await _saveOutputFiles({
      request,
      compileDir,
      resourceList,
      stats,
      timings,
    })
    error.outputFiles = outputFiles // return output files so user can check logs
    error.buildId = buildId
    // Clear project if this compile was abruptly terminated
    if (error.terminated || error.timedout) {
      await clearProjectWithListing(
        request.project_id,
        request.user_id,
        allEntries
      )
    }

    if (!_shouldSkipMetrics(request)) {
      const status = error.timedout
        ? 'timeout'
        : error.terminated
          ? 'terminated'
          : 'failure'
      timings.compile = Date.now() - compileStart
      _emitMetrics(request, status, stats, timings)
    }
    throw error
  }

  timings.compile = Date.now() - compileStart

  // Record the PNGs this compile flagged as "slow" so the next sync can convert
  // them to PDFs (see HistoryResourceWriter).
  // todo: generated for every project for analytics, filter to only  request.png2pdf once rollout completes
  if (request.isCompileFromHistory && Png2Pdf.isEnabled()) {
    try {
      const slowPngs = stats.latexmk?.['latexmk-png-slow'] || []
      await HistoryResourceWriter.saveSlowPngList(
        Path.basename(compileDir),
        slowPngs
      )
    } catch (err) {
      logger.warn(
        { err, projectId, userId },
        'failed to save png2pdf slow-png list'
      )
    }
  }

  logger.debug(
    {
      projectId: request.project_id,
      userId: request.user_id,
      timeTaken: timings.compile,
      stats,
      timings,
    },
    'done compile'
  )

  const { outputFiles, buildId } = await _saveOutputFiles({
    request,
    compileDir,
    resourceList,
    stats,
    timings,
  })
  timings.compileE2E = Date.now() - e2eCompileStart

  const status = stats['latexmk-errors'] ? 'error' : 'success'
  _emitMetrics(request, status, stats, timings)

  if (stats['pdf-size']) {
    emitPdfStats(stats, timings, request)
  }

  // Record compile performance for a subset of users
  if (recordPerformanceMetrics) {
    // Add fdb metrics if available
    try {
      const fdbFileContent = await _readFdbFile(compileDir)
      if (fdbFileContent) {
        addLatexFdbMetrics(fdbFileContent, stats)
      }
    } catch (err) {
      // ignore errors reading fdb file
      logger.warn(
        { err, projectId, userId },
        'error reading fdb file for performance metrics'
      )
    }

    const loadavg = typeof os.loadavg === 'function' ? os.loadavg() : undefined

    logger.info(
      {
        userId: request.user_id,
        projectId: request.project_id,
        timeTaken: timings.compile,
        clsiRequest: request,
        stats,
        timings,
        // explicitly include latexmk stats to bypass the non-enumerable property
        latexmk: stats.latexmk,
        loadavg1m: loadavg?.[0],
        loadavg5m: loadavg?.[1],
        loadavg15m: loadavg?.[2],
        samplingPercentage: Settings.performanceLogSamplingPercentage,
      },
      'sampled performance log'
    )
  }

  return { outputFiles, buildId }
}

async function _saveOutputFiles({
  request,
  compileDir,
  resourceList,
  stats,
  timings,
}) {
  const start = Date.now()
  const outputDir = getOutputDir(request.project_id, request.user_id)

  const { outputFiles: rawOutputFiles, allEntries } =
    await OutputFileFinder.promises.findOutputFiles(resourceList, compileDir)

  const { buildId, outputFiles } =
    await OutputCacheManager.promises.saveOutputFiles(
      { request, stats, timings },
      rawOutputFiles,
      compileDir,
      outputDir
    )

  timings.output = Date.now() - start
  return { outputFiles, allEntries, buildId }
}

// Set a maximum size for reading output.fdb_latexmk files
// This limit is chosen to prevent excessive memory usage and ensure performance,
// as fdb files are typically much smaller and only metrics are extracted from them.
const MAX_FDB_FILE_SIZE = 1024 * 1024 // 1 MB

async function _readFdbFile(compileDir) {
  const fdbFile = Path.join(compileDir, 'output.fdb_latexmk')
  const { result } = await SafeReader.promises.readFile(
    fdbFile,
    MAX_FDB_FILE_SIZE,
    'utf8'
  )
  return result
}

async function stopCompile(projectId, userId) {
  const compileName = getCompileName(projectId, userId)
  await LatexRunner.promises.killLatex(compileName)
}

async function clearProject(projectId, userId) {
  const compileDir = getCompileDir(projectId, userId)
  await fsPromises.rm(compileDir, { force: true, recursive: true })
}

async function clearProjectWithListing(projectId, userId, allEntries) {
  const compileDir = getCompileDir(projectId, userId)

  const exists = await _checkDirectory(compileDir)
  if (!exists) {
    // skip removal if no directory present
    return
  }

  for (const pathInProject of allEntries) {
    const path = Path.join(compileDir, pathInProject)
    if (path.endsWith('/')) {
      await fsPromises.rmdir(path)
    } else {
      await fsPromises.unlink(path)
    }
  }
  await fsPromises.rmdir(compileDir)
}

async function _findAllDirs() {
  const root = Settings.path.compilesDir
  const files = await fsPromises.readdir(root)
  const allDirs = files.map(file => Path.join(root, file))
  return allDirs
}

async function clearExpiredProjects(maxCacheAgeMs) {
  const now = Date.now()
  const dirs = await _findAllDirs()
  for (const dir of dirs) {
    let stats
    try {
      stats = await fsPromises.stat(dir)
    } catch (err) {
      // ignore errors checking directory
      continue
    }

    const age = now - stats.mtime
    const hasExpired = age > maxCacheAgeMs
    if (hasExpired) {
      await fsPromises.rm(dir, { force: true, recursive: true })
    }
  }
}

async function _checkDirectory(compileDir) {
  let stats
  try {
    stats = await fsPromises.lstat(compileDir)
  } catch (err) {
    if (err.code === 'ENOENT') {
      //  directory does not exist
      return false
    }
    OError.tag(err, 'error on stat of project directory for removal', {
      dir: compileDir,
    })
    throw err
  }
  if (!stats.isDirectory()) {
    throw new OError('project directory is not directory', {
      dir: compileDir,
      stats,
    })
  }
  return true
}

async function syncFromCode(projectId, userId, filename, line, column, opts) {
  // If LaTeX was run in a virtual environment, the file path that synctex expects
  // might not match the file path on the host. The .synctex.gz file however, will be accessed
  // wherever it is on the host.
  const compileName = getCompileName(projectId, userId)
  const baseDir = Settings.path.synctexBaseDir(compileName)
  const inputFilePath = Path.join(baseDir, filename)
  const outputFilePath = Path.join(baseDir, 'output.pdf')
  const command = [
    'synctex',
    'view',
    '-i',
    `${line}:${column}:${inputFilePath}`,
    '-o',
    outputFilePath,
  ]
  const { stdout, downloadedFromCache } = await _runSynctex(
    projectId,
    userId,
    command,
    opts
  )
  logger.debug(
    { projectId, userId, filename, line, column, command, stdout },
    'synctex code output'
  )
  return {
    codePositions: SynctexOutputParser.parseViewOutput(stdout),
    downloadedFromCache,
  }
}

async function syncFromPdf(projectId, userId, page, h, v, opts) {
  const compileName = getCompileName(projectId, userId)
  const baseDir = Settings.path.synctexBaseDir(compileName)
  const outputFilePath = `${baseDir}/output.pdf`
  const command = [
    'synctex',
    'edit',
    '-o',
    `${page}:${h}:${v}:${outputFilePath}`,
  ]
  const { stdout, downloadedFromCache } = await _runSynctex(
    projectId,
    userId,
    command,
    opts
  )
  logger.debug({ projectId, userId, page, h, v, stdout }, 'synctex pdf output')
  return {
    pdfPositions: SynctexOutputParser.parseEditOutput(stdout, baseDir),
    downloadedFromCache,
  }
}

async function _checkFileExists(dir, filename) {
  try {
    await fsPromises.stat(dir)
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Errors.NotFoundError('no output directory')
    }
    throw error
  }

  const file = Path.join(dir, filename)
  let stats
  try {
    stats = await fsPromises.stat(file)
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Errors.NotFoundError('no output file')
    }
    throw error
  }
  if (!stats.isFile()) {
    throw new Error('not a file')
  }
}

async function _runSynctex(projectId, userId, command, opts) {
  const { imageName, editorId, buildId, compileFromClsiCache } = opts

  if (imageName && !_isImageNameAllowed(imageName)) {
    throw new Errors.InvalidParameter('invalid image')
  }
  if (editorId && !/^[a-f0-9-]+$/.test(editorId)) {
    throw new Errors.InvalidParameter('invalid editorId')
  }
  if (buildId && !OutputCacheManager.BUILD_REGEX.test(buildId)) {
    throw new Errors.InvalidParameter('invalid buildId')
  }

  const outputDir = getOutputDir(projectId, userId)
  const runInOutputDir = buildId && CommandRunner.canRunSyncTeXInOutputDir()

  const directory = runInOutputDir
    ? Path.join(outputDir, OutputCacheManager.CACHE_SUBDIR, buildId)
    : getCompileDir(projectId, userId)
  const timeout = 60 * 1000 // increased to allow for large projects
  const compileName = getCompileName(projectId, userId)
  const compileGroup = runInOutputDir ? 'synctex-output' : 'synctex'
  const defaultImageName =
    Settings.clsi && Settings.clsi.docker && Settings.clsi.docker.image
  // eslint-disable-next-line @typescript-eslint/return-await
  return await OutputCacheManager.promises.queueDirOperation(
    outputDir,
    /**
     * @return {Promise<{stdout: string, downloadedFromCache: boolean}>}
     */
    async () => {
      let downloadedFromCache = false
      try {
        await _checkFileExists(directory, 'output.synctex.gz')
        if (compileFromClsiCache) {
          try {
            await _checkFileExists(directory, 'output.log')
          } catch (err) {
            if (err instanceof Errors.NotFoundError) downloadedFromCache = true
          }
        }
      } catch (err) {
        if (
          err instanceof Errors.NotFoundError &&
          compileFromClsiCache &&
          editorId &&
          buildId
        ) {
          try {
            downloadedFromCache =
              await downloadOutputDotSynctexFromCompileCache(
                projectId,
                userId,
                editorId,
                buildId,
                directory
              )
          } catch (err) {
            logger.warn(
              { err, projectId, userId, editorId, buildId },
              'failed to download output.synctex.gz from clsi-cache'
            )
          }
          await _checkFileExists(directory, 'output.synctex.gz')
        } else {
          throw err
        }
      }
      try {
        const { stdout } = await CommandRunner.promises.run(
          compileName,
          command,
          directory,
          imageName || defaultImageName,
          timeout,
          {},
          compileGroup,
          null
        )
        return {
          stdout,
          downloadedFromCache,
        }
      } catch (error) {
        throw OError.tag(error, 'error running synctex', {
          command,
          projectId,
          userId,
        })
      }
    }
  )
}

async function _syncResourcesForWordcount(
  projectId,
  userId,
  filename,
  compileDir,
  request
) {
  // Always write, rather than skipping when the root file is already there:
  // texcount reads every included file, so they all have to be current.
  const lock = LockManager.acquire(compileDir)
  try {
    Metrics.inc('wordcount_sync_resources')
    if (request.isCompileFromHistory) {
      await HistoryResourceWriter.syncResourcesToDisk(
        projectId,
        userId,
        request,
        compileDir,
        {}, // timings
        {} // stats
      )
    } else {
      await ResourceWriter.promises.syncResourcesToDisk(request, compileDir)
    }
  } catch (err) {
    if (err instanceof Errors.MissingUpdatesError) throw err
    throw OError.tag(err, 'error syncing resources for wordcount', {
      projectId,
      userId,
      filename,
    })
  } finally {
    lock.release()
  }
}

async function wordcount(projectId, userId, filename, image, request) {
  logger.debug({ projectId, userId, filename, image }, 'running wordcount')
  const filePath = `$COMPILE_DIR/${filename}`
  const command = ['texcount', '-nocol', '-inc', filePath]
  const compileDir = getCompileDir(projectId, userId)
  const timeout = 60 * 1000
  const compileName = getCompileName(projectId, userId)
  const compileGroup = 'wordcount'

  if (image && !_isImageNameAllowed(image)) {
    throw new Errors.InvalidParameter('invalid image')
  }

  let isNewCompileDir
  try {
    isNewCompileDir =
      (await fsPromises.mkdir(compileDir, { recursive: true })) === compileDir
  } catch (err) {
    throw OError.tag(err, 'error ensuring dir for wordcount', {
      projectId,
      userId,
      filename,
    })
  }

  if (isNewCompileDir && request?.compileFromClsiCache) {
    // We are bootstrapping the compile dir on this clsi. Restore the cached
    // outputs too, so the next compile does not start from scratch.
    try {
      await downloadLatestCompileCache(projectId, userId, compileDir)
    } catch (err) {
      logger.warn(
        { err, projectId, userId },
        'failed to populate compile dir from cache'
      )
    }
  }

  if (request) {
    await _syncResourcesForWordcount(
      projectId,
      userId,
      filename,
      compileDir,
      request
    )
  }

  try {
    const { stdout } = await CommandRunner.promises.run(
      compileName,
      command,
      compileDir,
      image,
      timeout,
      {},
      compileGroup,
      null
    )
    const results = _parseWordcountFromOutput(stdout)
    logger.debug(
      { projectId, userId, wordcount: results },
      'word count results'
    )
    return results
  } catch (err) {
    throw OError.tag(err, 'error reading word count output', {
      command,
      compileDir,
      projectId,
      userId,
    })
  }
}

function _parseWordcountFromOutput(output) {
  const results = {
    encode: '',
    textWords: 0,
    headWords: 0,
    outside: 0,
    headers: 0,
    elements: 0,
    mathInline: 0,
    mathDisplay: 0,
    errors: 0,
    messages: '',
  }
  for (const line of output.split('\n')) {
    const [data, info] = line.split(':')
    if (data.indexOf('Encoding') > -1) {
      results.encode = info.trim()
    }
    if (data.indexOf('in text') > -1) {
      results.textWords = parseInt(info, 10)
    }
    if (data.indexOf('in head') > -1) {
      results.headWords = parseInt(info, 10)
    }
    if (data.indexOf('outside') > -1) {
      results.outside = parseInt(info, 10)
    }
    if (data.indexOf('of head') > -1) {
      results.headers = parseInt(info, 10)
    }
    if (data.indexOf('Number of floats/tables/figures') > -1) {
      results.elements = parseInt(info, 10)
    }
    if (data.indexOf('Number of math inlines') > -1) {
      results.mathInline = parseInt(info, 10)
    }
    if (data.indexOf('Number of math displayed') > -1) {
      results.mathDisplay = parseInt(info, 10)
    }
    if (data === '(errors') {
      // errors reported as (errors:123)
      results.errors = parseInt(info, 10)
    }
    if (line.indexOf('!!! ') > -1) {
      // errors logged as !!! message !!!
      results.messages += line + '\n'
    }
  }
  return results
}

function _getAllowedImages() {
  return Settings.clsi?.docker?.allowedImages
}

function _isImageNameAllowed(imageName) {
  const allowedImages = _getAllowedImages()
  return !allowedImages || allowedImages.includes(imageName)
}

// Variants are images built on top of a base image, tagged with a suffix, eg
// texlive-full:2026.1.checkpointing is the checkpointing variant of
// texlive-full:2026.1. Returns the settings needed to compile the request on
// the variant its options call for: the image to run and the environment that
// image needs. Falls back to the requested image when no variant applies, or
// when the variant is not available on this host.
function _getImageVariantSettings(request) {
  const { imageName } = request

  // checkpointing compiles run on the checkpointing variant of the image
  if (request.enableCheckpoint) {
    const checkpointingImageName = `${imageName}.checkpointing`
    if (imageName && _getAllowedImages()?.includes(checkpointingImageName)) {
      return {
        imageName: checkpointingImageName,
        env: { ENABLE_CHECKPOINT: '1' },
      }
    }
    // variant either doesnt exist when it should, or user was able to make a request they shouldnt be able to
    logger.error(
      {
        projectId: request.project_id,
        userId: request.user_id,
        imageName,
      },
      'no checkpointing variant available for image, compiling without it'
    )
  }

  return { imageName, env: {} }
}

function _shouldSkipMetrics(request) {
  return ['clsi-perf', 'health-check'].includes(request.metricsOpts.path)
}

function _emitMetrics(request, status, stats, timings) {
  if (_shouldSkipMetrics(request)) {
    return
  }

  // find the image tag to log it as a metric, e.g. 2015.1
  let tag = 'default'
  if (request.imageName != null) {
    const match = request.imageName.match(/:(.*)/)
    if (match != null) {
      tag = match[1]
    }
  }

  const runs = stats.latexmk?.['latexmk-rule-times']
  let passes = 0
  if (runs != null) {
    let cumulativeRuleTimeMs = 0
    for (const run of runs) {
      if (LATEX_PASSES_RULES.has(run.rule)) {
        passes += 1
      }

      const rule = KNOWN_LATEXMK_RULES.has(run.rule) ? run.rule : 'other'
      ClsiMetrics.latexmkRuleDurationSeconds.observe(
        {
          group: request.compileGroup,
          rule,
        },
        run.time_ms / 1000
      )
      cumulativeRuleTimeMs += run.time_ms
    }

    const totalTimeMs = stats.latexmk?.['latexmk-time']?.total
    if (totalTimeMs != null) {
      ClsiMetrics.latexmkRuleDurationSeconds.observe(
        { group: request.compileGroup, rule: 'overhead' },
        (totalTimeMs - cumulativeRuleTimeMs) / 1000
      )
    }
  }

  const imgTimings = stats.latexmk?.['latexmk-img-times']
  if (imgTimings != null) {
    for (const timing of imgTimings) {
      ClsiMetrics.imageProcessingDurationSeconds.observe(
        {
          group: request.compileGroup,
          type: timing.type,
        },
        timing.time_ms / 1000
      )
    }
  }

  ClsiMetrics.compilesTotal.inc({
    status,
    engine: request.compiler,
    image: tag,
    compile: request.metricsOpts.compile,
    group: request.compileGroup,
    draft: request.draft ? 'true' : 'false',
    stop_on_first_error: request.stopOnFirstError ? 'true' : 'false',
    passes,
  })

  if (timings.sync != null) {
    ClsiMetrics.syncResourcesDurationSeconds.observe(
      {
        type: request.syncType,
        compile: request.metricsOpts.compile,
        group: request.compileGroup,
      },
      timings.sync / 1000
    )
  }

  if (timings.compile != null) {
    ClsiMetrics.compileDurationSeconds.observe(
      {
        status,
        engine: request.compiler,
        compile: request.metricsOpts.compile,
        group: request.compileGroup,
        passes: passes === 0 ? 'none' : passes === 1 ? 'single' : 'multiple',
      },
      timings.compile / 1000
    )
  }

  if (timings.output != null) {
    ClsiMetrics.processOutputFilesDurationSeconds.observe(
      {
        compile: request.metricsOpts.compile,
        group: request.compileGroup,
      },
      timings.output / 1000
    )
  }

  if (timings.compileE2E != null) {
    ClsiMetrics.e2eCompileDurationSeconds.observe(timings.compileE2E / 1000)
  }
}

module.exports = {
  doCompileWithLock: callbackify(doCompileWithLock),
  stopCompile: callbackify(stopCompile),
  clearProject: callbackify(clearProject),
  clearExpiredProjects: callbackify(clearExpiredProjects),
  syncFromCode: callbackifyMultiResult(syncFromCode, [
    'codePositions',
    'downloadedFromCache',
  ]),
  syncFromPdf: callbackifyMultiResult(syncFromPdf, [
    'pdfPositions',
    'downloadedFromCache',
  ]),
  wordcount: callbackify(wordcount),
  promises: {
    doCompileWithLock,
    stopCompile,
    clearProject,
    clearExpiredProjects,
    syncFromCode,
    syncFromPdf,
    wordcount,
  },
}
