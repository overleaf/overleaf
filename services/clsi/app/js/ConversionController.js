import logger from '@overleaf/logger'
import { expressify } from '@overleaf/promise-utils'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import ConversionManager from './ConversionManager.js'
import { pipeline } from 'node:stream/promises'
import Settings from '@overleaf/settings'
import Path from 'node:path'

async function convertDocxToLaTeX(req, res) {
  const { path } = req.file
  if (!Settings.enablePandocConversions) {
    await fs.unlink(path).catch(() => {})
    return res.sendStatus(404)
  }
  logger.debug({ path }, 'received file for conversion')
  const conversionId = crypto.randomUUID()
  let zipPath
  try {
    zipPath = await ConversionManager.promises.convertDocxToLaTeXWithLock(
      conversionId,
      path
    )
  } finally {
    await fs.unlink(path).catch(() => {})
  }

  try {
    const zipStat = await fs.stat(zipPath)

    res.setHeader('Content-Length', zipStat.size)
    res.attachment('conversion.zip')
    res.setHeader('X-Content-Type-Options', 'nosniff')

    const readStream = fsSync.createReadStream(zipPath)
    await pipeline(readStream, res)
  } finally {
    await fs
      .rm(Path.dirname(zipPath), { recursive: true, force: true })
      .catch(() => {})
  }
}

export default {
  convertDocxToLaTeX: expressify(convertDocxToLaTeX),
}
