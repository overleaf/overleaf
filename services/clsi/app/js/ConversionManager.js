import logger from '@overleaf/logger'
import Settings from '@overleaf/settings'
import fs from 'node:fs/promises'
import Path from 'node:path'
import CommandRunner from './CommandRunner.js'
import LockManager from './LockManager.js'
import OError from '@overleaf/o-error'
import { ConversionError } from './Errors.js'

const CONVERSION_CONFIGS = {
  docx: {
    inputFilename: 'input.docx',
    pandocArgs: ['--extract-media=.', '--from', 'docx+citations', '--citeproc'],
  },
  markdown: {
    inputFilename: 'input.md',
    pandocArgs: ['--from', 'markdown'],
  },
}

const PDF_TO_JPEG_CONFIGS = {
  preview: { width: 794, quality: 90 },
  thumbnail: { width: 190, quality: 50 },
}

const PDF_TO_JPEG_INPUT_FILENAME = 'input.pdf'
const PDF_TO_JPEG_OUTPUT_FILENAME = 'output.jpg'
const PDF_TO_JPEG_OUTPUT_BASENAME = Path.basename(
  PDF_TO_JPEG_OUTPUT_FILENAME,
  '.jpg'
)

async function convertToLaTeXWithLock(conversionId, inputPath, conversionType) {
  const conversionDir = Path.join(Settings.path.compilesDir, conversionId)
  const lock = LockManager.acquire(conversionDir)
  try {
    return await convertToLaTeX(
      conversionId,
      conversionDir,
      inputPath,
      conversionType
    )
  } finally {
    lock.release()
  }
}

async function convertToLaTeX(
  conversionId,
  conversionDir,
  inputPath,
  conversionType
) {
  const config = CONVERSION_CONFIGS[conversionType]
  if (!config) {
    throw new OError('unsupported conversion type', { conversionType })
  }
  await fs.mkdir(conversionDir, { recursive: true })
  const newSourcePath = Path.join(conversionDir, config.inputFilename)
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
        config.inputFilename,
        '--output',
        'main.tex',
        '--to',
        'latex',
        '--standalone',
        ...config.pandocArgs,
      ],
      conversionDir,
      Settings.pandocImage,
      Settings.conversionTimeoutSeconds * 1000,
      {},
      'conversions',
      null
    )
    if (exitCodePandoc !== 0) {
      throw new ConversionError('Non-zero exit code from pandoc', {
        type: conversionType,
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
      'conversions',
      null
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
    if (error instanceof ConversionError) {
      throw error
    }
    throw new OError('pandoc conversion failed').withCause(error)
  }

  return Path.join(conversionDir, outputName)
}

const LATEX_EXPORT_CONFIGS = {
  docx: {
    fileExtension: 'docx',
    compressOutput: false,
    getPandocArgs: ({ outputPath }) => [
      '--output',
      outputPath,
      '--from',
      'latex',
      '--to',
      'docx',
      '--citeproc',
      '--number-sections',
    ],
  },
  markdown: {
    fileExtension: 'md',
    compressOutput: true,
    getPandocArgs: ({ outputPath }) => [
      '--output',
      outputPath,
      '--from',
      'latex',
      '--to',
      'markdown',
    ],
  },
  html: {
    fileExtension: 'html',
    compressOutput: true,
    getPandocArgs: ({ outputPath }) => [
      '--output',
      outputPath,
      '--from',
      'latex',
      '--to',
      'html',
      '--standalone',
      '--mathml',
    ],
  },
}

async function convertLaTeXToDocumentInDirWithLock(
  conversionId,
  compileDir,
  rootDocPath,
  type
) {
  const lock = LockManager.acquire(compileDir)
  try {
    return await convertLaTeXToDocumentInDir(
      conversionId,
      compileDir,
      rootDocPath,
      type
    )
  } finally {
    lock.release()
  }
}

async function convertLaTeXToDocumentInDir(
  conversionId,
  compileDir,
  rootDocPath = 'main.tex',
  type
) {
  if (!Object.hasOwn(LATEX_EXPORT_CONFIGS, type)) {
    throw new OError('unsupported conversion type', { type })
  }
  const config = LATEX_EXPORT_CONFIGS[type]

  const timeoutMs = Settings.conversionTimeoutSeconds * 1000
  const outputId = crypto.randomUUID()

  logger.debug(
    { compileDir, rootDocPath, type },
    'running pandoc latex-to-document in compile dir'
  )

  if (!config.compressOutput) {
    const outputName = `${outputId}.${config.fileExtension}`
    const { exitCode, stdout, stderr } = await CommandRunner.promises.run(
      conversionId,
      [
        'pandoc',
        rootDocPath,
        ...config.getPandocArgs({ outputPath: outputName }),
        '--resource-path=.',
      ],
      compileDir,
      Settings.pandocImage,
      timeoutMs,
      {},
      'conversions',
      null
    )

    if (exitCode !== 0) {
      throw new ConversionError('pandoc latex-to-document conversion failed', {
        type,
        exitCode,
        stderr,
      })
    }

    logger.debug(
      { stdout, stderr, exitCode },
      'pandoc latex-to-document conversion completed'
    )

    return Path.join(compileDir, outputName)
  }

  // For compressed outputs  we stage everything inside a uuid subdir so
  // the archive root ends up flat:
  //   - pandoc runs with cwd=<outputId>, --extract-media=. drops images flat
  //     alongside main.<ext>, and --resource-path=.. lets it find originals
  //     in the parent compile dir.
  //   - zip runs with the same cwd, so `zip -r ../<id>.zip .` produces an
  //     archive whose root is main.<ext> + the media files (no uuid leak,
  //     no collision with anything already in compileDir).
  await fs.mkdir(Path.join(compileDir, outputId), { recursive: true })

  const outputName = `main.${config.fileExtension}`
  const finalOutputName = `${outputId}.zip`

  const { exitCode, stdout, stderr } = await CommandRunner.promises.run(
    conversionId,
    [
      'pandoc',
      Path.join('..', rootDocPath),
      ...config.getPandocArgs({ outputPath: outputName }),
      '--resource-path=..',
      '--extract-media=.',
    ],
    compileDir,
    Settings.pandocImage,
    timeoutMs,
    {
      // By default pandoc uses cwd for resolving \input, \include, etc.
      // Setting TEXINPUTS allows us to override that to look in the actual
      // compileDir rather than the output directory.
      TEXINPUTS: '..:',
    },
    'conversions',
    outputId
  )

  if (exitCode !== 0) {
    throw new ConversionError('pandoc latex-to-document conversion failed', {
      type,
      exitCode,
      stderr,
    })
  }

  logger.debug(
    { stdout, stderr, exitCode },
    'pandoc latex-to-document conversion completed'
  )

  const {
    exitCode: zipExitCode,
    stdout: zipStdout,
    stderr: zipStderr,
  } = await CommandRunner.promises.run(
    conversionId,
    ['zip', '-r', Path.join('..', finalOutputName), '.'],
    compileDir,
    Settings.pandocImage,
    timeoutMs,
    {},
    'conversions',
    outputId
  )

  if (zipExitCode !== 0) {
    throw new OError('zip compression of export failed', {
      exitCode: zipExitCode,
      stdout: zipStdout,
      stderr: zipStderr,
    })
  }

  logger.debug(
    { stdout: zipStdout, stderr: zipStderr, exitCode: zipExitCode },
    'export compressed'
  )

  return Path.join(compileDir, finalOutputName)
}

async function convertPDFToJPEGWithLock(conversionId, inputPath, mode) {
  const conversionDir = Path.join(Settings.path.compilesDir, conversionId)
  const lock = LockManager.acquire(conversionDir)
  try {
    return await convertPDFToJPEG(conversionId, conversionDir, inputPath, mode)
  } finally {
    lock.release()
  }
}

async function convertPDFToJPEG(conversionId, conversionDir, inputPath, mode) {
  const config = PDF_TO_JPEG_CONFIGS[mode]
  await fs.mkdir(conversionDir, { recursive: true })
  const newSourcePath = Path.join(conversionDir, PDF_TO_JPEG_INPUT_FILENAME)
  await fs.copyFile(inputPath, newSourcePath)
  const dstPath = Path.join(conversionDir, PDF_TO_JPEG_OUTPUT_FILENAME)

  try {
    const { stdout, stderr, exitCode } = await CommandRunner.promises.run(
      conversionId,
      [
        'pdftocairo',
        '-jpeg',
        '-jpegopt',
        `quality=${config.quality}`,
        '-singlefile',
        '-scale-to-x',
        config.width.toString(),
        '-scale-to-y',
        '-1', // maintain aspect ratio
        PDF_TO_JPEG_INPUT_FILENAME,
        PDF_TO_JPEG_OUTPUT_BASENAME,
      ],
      conversionDir,
      Settings.pdftocairoImage,
      Settings.conversionTimeoutSeconds * 1000,
      {},
      'conversions',
      null
    )
    if (exitCode !== 0) {
      throw new OError('Non-zero exit code from pdftocairo', {
        exitCode,
        stderr,
      })
    }
    logger.debug(
      { stdout, stderr, exitCode },
      'pdf-to-jpeg conversion completed'
    )

    const stat = await fs.lstat(dstPath)
    if (!stat.isFile()) {
      throw new OError('output.jpg is not a regular file', { stat })
    }

    // Clean up the source PDF to leave only the conversion result
    await fs.unlink(newSourcePath).catch(() => {})
  } catch (error) {
    await fs.rm(conversionDir, { force: true, recursive: true }).catch(() => {})
    throw new OError('pdf-to-jpeg conversion failed').withCause(error)
  }

  return dstPath
}

export default {
  promises: {
    convertToLaTeXWithLock,
    convertLaTeXToDocumentInDirWithLock,
    convertPDFToJPEGWithLock,
  },
}
