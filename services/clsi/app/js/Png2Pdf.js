import logger from '@overleaf/logger'
import Settings from '@overleaf/settings'
import Metrics from '@overleaf/metrics'
import OError from '@overleaf/o-error'
import CommandRunner from './CommandRunner.js'

// Convert "slow" PNGs (e.g. with transparency) to PDF ahead of the compile, so
// that pdflatex can include them via the fast native path instead of paying the
// conversion cost on every run. The png2pdf tool overwrites each file in place
// with PDF bytes (pdflatex looks at file content, not the extension); PNGs that
// are already fast-includable are left unchanged.
//
// The conversion runs in an isolated, network-disabled container built FROM
// scratch (see dockerfiles/png2pdf), with the project's cache dir bind-mounted.

/**
 * Whether png-to-pdf conversion is available in this deployment. It requires
 * sandboxed (docker) compiles, the host path of the cache dir (so the sibling
 * container can bind-mount it) and a configured image.
 *
 * @return {boolean}
 */
export function isEnabled() {
  return Boolean(
    Settings.enablePng2pdfConversions &&
    Settings.clsi?.dockerRunner === true &&
    Settings.path.sandboxedCompilesHostDirCache &&
    Settings.png2pdfImage
  )
}

// The tool prints one "Converted <file> to PDF" line per file it actually
// converts; already-fast PNGs are skipped silently.
const CONVERTED_LINE = /^Converted .+ to PDF$/gm

/**
 * Run the png2pdf binary over a list of files living directly inside a project's
 * cache dir, converting them in place. Files are processed sequentially by the
 * binary in a single container invocation.
 *
 * @param {string} projectId
 * @param {string} cacheProjectDir absolute path to the project's cache dir
 * @param {string[]} relativePaths file names within cacheProjectDir to convert
 * @param {Record<string, number>} stats
 * @param {Record<string, number>} timings
 * @return {Promise<void>}
 */
export async function convertPngFilesInCacheDir(
  projectId,
  cacheProjectDir,
  relativePaths,
  stats,
  timings
) {
  if (!isEnabled()) return

  const timer = new Metrics.Timer('png2pdf')
  try {
    const { stdout, stderr, exitCode } = await CommandRunner.promises.run(
      projectId,
      // `--` terminates option parsing: the cache file names start with a `-`
      // (the leading `/` of the blob URL path), which clap would otherwise treat
      // as a flag.
      ['--in-place', '--', ...relativePaths],
      cacheProjectDir,
      Settings.png2pdfImage,
      Settings.conversionTimeoutSeconds * 1000,
      {},
      'png2pdf',
      null
    )
    if (exitCode !== 0) {
      throw new OError('non-zero exit code from png2pdf', {
        exitCode,
        stdout,
        stderr,
      })
    }
    const converted = (stdout.match(CONVERTED_LINE) || []).length
    logger.debug(
      { projectId, attempted: relativePaths.length, converted, stdout, stderr },
      'png2pdf conversion completed'
    )
    Metrics.count('png2pdf-converted', converted)
    stats.png2pdf = converted
    timings.png2pdf = timer.done({ status: 'success' })
  } catch (err) {
    timings.png2pdf = timer.done({ status: 'error' })
    throw OError.tag(err, 'png2pdf conversion failed', {
      projectId,
      count: relativePaths.length,
    })
  }
}

export default { isEnabled, convertPngFilesInCacheDir }
