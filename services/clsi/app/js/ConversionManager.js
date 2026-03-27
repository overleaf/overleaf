import logger from '@overleaf/logger'
import Settings from '@overleaf/settings'
import fs from 'node:fs/promises'
import Path from 'node:path'
import CommandRunner from './CommandRunner.js'
import LockManager from './LockManager.js'
import OError from '@overleaf/o-error'

async function convertDocxToLaTeXWithLock(conversionId, inputPath) {
  const conversionDir = Path.join(Settings.path.compilesDir, conversionId)
  const lock = LockManager.acquire(conversionDir)
  try {
    return await convertDocxToLaTeX(conversionId, conversionDir, inputPath)
  } finally {
    lock.release()
  }
}

async function convertDocxToLaTeX(conversionId, conversionDir, inputPath) {
  await fs.mkdir(conversionDir, { recursive: true })
  const newSourcePath = Path.join(conversionDir, 'input.docx')
  await fs.copyFile(inputPath, newSourcePath)
  const outputName = crypto.randomUUID() + '.zip'

  try {
    const {
      stdout: stdoutPandoc,
      stderr: stderrPandoc,
      exitCode: exitCodePandoc,
    } = await CommandRunner.promises.run(
      conversionId,
      [
        'pandoc',
        'input.docx',
        '--output',
        'main.tex',
        '--extract-media=.',
        '--from',
        'docx+citations',
        '--to',
        'latex',
        '--citeproc',
        '--standalone',
      ],
      conversionDir,
      Settings.pandocImage,
      Settings.conversionTimeoutSeconds * 1000,
      {},
      'conversions'
    )
    if (exitCodePandoc !== 0) {
      throw new OError('Non-zero exit code from pandoc', {
        exitCode: exitCodePandoc,
        stderr: stderrPandoc,
      })
    }
    logger.debug(
      { stdout: stdoutPandoc, stderr: stderrPandoc, exitCode: exitCodePandoc },
      'conversion command completed'
    )

    // Clean up the source document to leave only the conversion result
    await fs.unlink(newSourcePath).catch(() => {})

    const {
      stdout: stdoutZip,
      stderr: stderrZip,
      exitCode: exitCodeZip,
    } = await CommandRunner.promises.run(
      conversionId,
      ['zip', '-r', outputName, '.'],
      conversionDir,
      Settings.pandocImage,
      Settings.conversionTimeoutSeconds * 1000,
      {},
      'conversions'
    )
    if (exitCodeZip !== 0) {
      throw new OError('Non-zero exit code from pandoc', {
        exitCode: exitCodeZip,
        stderr: stderrZip,
      })
    }
    logger.debug(
      { stdout: stdoutZip, stderr: stderrZip, exitCode: exitCodeZip },
      'conversion output compressed'
    )
  } catch (error) {
    // Clean up the conversion directory on error to avoid leaving failed conversions around
    await fs.rm(conversionDir, { force: true, recursive: true }).catch(() => {})
    throw new OError('pandoc conversion failed').withCause(error)
  }

  return Path.join(conversionDir, outputName)
}

export default {
  promises: {
    convertDocxToLaTeXWithLock,
  },
}
