import Settings from '@overleaf/settings'
import CompileManager from '../Compile/CompileManager.mjs'
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import logger from '@overleaf/logger'
import Path from 'node:path'
import { fetchStreamWithResponse } from '@overleaf/fetch-utils'
import { pipeline } from 'node:stream/promises'
import OError from '@overleaf/o-error'
import FormData from 'form-data'
import { FileTooLargeError } from '../Errors/Errors.js'

async function convertDocxToLaTeXZipArchive(path, userId) {
  const clsiUrl = new URL(Settings.apis.clsi.url)
  const limits = await CompileManager.promises._getUserCompileLimits(userId)

  clsiUrl.pathname = '/convert/docx-to-latex'
  clsiUrl.searchParams.set('compileBackendClass', limits.compileBackendClass)
  clsiUrl.searchParams.set('compileGroup', limits.compileGroup)

  const formData = new FormData()
  formData.append('qqfile', fs.createReadStream(path))

  logger.debug(
    { clsiUrl: clsiUrl.toString() },
    'sending docx to CLSI for conversion'
  )

  const outputFileName = crypto.randomUUID() + '.zip'
  const outputPath = Path.join(Settings.path.dumpFolder, outputFileName)
  let outputStream
  const abortController = new AbortController()

  try {
    const { stream, response } = await fetchStreamWithResponse(clsiUrl, {
      method: 'POST',
      body: formData,
      signal: abortController.signal,
    })

    const contentLengthHeader = response.headers.get('Content-Length')
    if (contentLengthHeader == null) {
      logger.warn(
        'CLSI did not provide Content-Length header for converted document'
      )
      throw new OError('CLSI response missing Content-Length header')
    }
    const contentLength = parseInt(contentLengthHeader, 10)
    if (contentLength > Settings.maxUploadSize) {
      abortController.abort()
      stream.destroy()
      throw new FileTooLargeError({
        message: 'converted document archive too large',
        info: {
          size: contentLength,
        },
      })
    }

    outputStream = fs.createWriteStream(outputPath)

    await pipeline(stream, outputStream)
    logger.debug({ outputPath }, 'received converted file from CLSI')
  } catch (error) {
    logger.error({ err: error }, 'error during document conversion')
    outputStream?.destroy()
    // Make sure to clean up the output file if conversion didn't work
    await fsPromises.unlink(outputPath).catch(() => {})

    if (error instanceof FileTooLargeError) {
      throw error
    }

    throw new OError('document conversion failed').withCause(error)
  }

  return outputPath
}

export default {
  promises: {
    convertDocxToLaTeXZipArchive,
  },
}
