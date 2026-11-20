import crypto from 'node:crypto'
import logger from '@overleaf/logger'
import Settings from '@overleaf/settings'
import redis from '@overleaf/redis-wrapper'
import { addRequiredCleanupHandlerBeforeDrainingConnections } from '../../infrastructure/GracefulShutdown.mjs'
import mongoose from '../../infrastructure/Mongoose.mjs'
import RedisWrapper from '../../infrastructure/RedisWrapper.mjs'
import { sanitizeControlCharacters } from '../../infrastructure/Sanitize.mjs'

const COLLECTION_NAME = 'workspaceSettings'
const DOC_ID = 'workspace_branding'
const PUB_SUB_CHANNEL = 'refresh-workspace-branding'
const CACHE_TTL_MS = 15 * 1000
const MAX_LOGO_BYTES = 512 * 1024

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
])

function createValidationError(message) {
  const err = new Error(message)
  err.statusCode = 400
  return err
}

function extractBuffer(rawData) {
  if (!rawData) return null
  if (Buffer.isBuffer(rawData)) return rawData
  if (rawData._bsontype === 'Binary' && rawData.buffer) {
    return Buffer.from(rawData.buffer)
  }
  if (rawData instanceof Uint8Array) {
    return Buffer.from(rawData)
  }
  if (typeof rawData === 'string') {
    return Buffer.from(rawData, 'base64')
  }
  return null
}

function validateSvgSafety(buffer) {
  const svgText = buffer.toString('utf8')
  if (!/<svg[\s>]/i.test(svgText)) {
    throw createValidationError('Uploaded SVG file must contain a root <svg> element')
  }
  if (
    /<script[\s>]/i.test(svgText) ||
    /<\/script/i.test(svgText) ||
    /javascript:/i.test(svgText) ||
    /vbscript:/i.test(svgText) ||
    /data\s*:\s*text\/html/i.test(svgText) ||
    /<(?:iframe|object|embed|foreignObject)[\s>]/i.test(svgText) ||
    /\bon[a-z]+\s*=/i.test(svgText)
  ) {
    throw createValidationError(
      'Uploaded SVG contains unsupported active scripts or embedded content'
    )
  }
}

function validateBinaryMagic(mimeType, buffer) {
  if (mimeType === 'image/png') {
    const isPng =
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    if (!isPng) {
      throw createValidationError('Invalid PNG image signature')
    }
    return
  }

  if (mimeType === 'image/jpeg') {
    const isJpeg =
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    if (!isJpeg) {
      throw createValidationError('Invalid JPEG image signature')
    }
    return
  }

  if (mimeType === 'image/webp') {
    const isWebp =
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    if (!isWebp) {
      throw createValidationError('Invalid WebP image signature')
    }
    return
  }

  if (mimeType === 'image/svg+xml') {
    validateSvgSafety(buffer)
  }
}

export function parseAndValidateLogoDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') {
    throw createValidationError('Invalid logo image payload')
  }
  const match = dataUrl.match(/^data:([^;]+);base64,([A-Za-z0-9+/=\s]+)$/)
  if (!match) {
    throw createValidationError(
      'Logo image must be a base64 data URL (PNG, JPEG, WebP, or SVG)'
    )
  }
  const mimeType = match[1].trim().toLowerCase()
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw createValidationError(
      'Unsupported logo format. Please upload a PNG, SVG, JPEG, or WebP image.'
    )
  }
  const base64Body = match[2].replace(/\s+/g, '')
  const buffer = Buffer.from(base64Body, 'base64')
  if (!buffer.length) {
    throw createValidationError('Uploaded logo file is empty')
  }
  if (buffer.length > MAX_LOGO_BYTES) {
    throw createValidationError('Logo image must be 512 KB or smaller')
  }
  validateBinaryMagic(mimeType, buffer)
  return {
    data: buffer,
    mimeType,
    sizeBytes: buffer.length,
  }
}

function buildSummary(record) {
  const version = record?.version || ''
  const hasCustomLogo = Boolean(record?.lightLogo?.data)
  const hasCustomLogoDark = Boolean(record?.darkLogo?.data)
  const logoUrl = hasCustomLogo
    ? `/api/branding/logo${version ? `?v=${encodeURIComponent(version)}` : ''}`
    : null
  const logoDarkUrl = hasCustomLogoDark
    ? `/api/branding/logo-dark${version ? `?v=${encodeURIComponent(version)}` : ''}`
    : logoUrl
  return {
    hasCustomLogo,
    logoUrl,
    hasCustomLogoDark,
    logoDarkUrl,
    organizationName: record?.organizationName || '',
    version,
    updatedAt: record?.updatedAt || null,
  }
}

function computeVersion(lightLogo, darkLogo, organizationName) {
  const hash = crypto.createHash('sha256')
  hash.update(String(organizationName || ''))
  if (lightLogo?.data) {
    hash.update(lightLogo.mimeType || '')
    hash.update(lightLogo.data)
  }
  if (darkLogo?.data) {
    hash.update(darkLogo.mimeType || '')
    hash.update(darkLogo.data)
  }
  hash.update(String(Date.now()))
  return hash.digest('hex').slice(0, 12)
}

let cachedRecord = null
let cachedSummary = buildSummary(null)
let lastLoadedAt = 0
let refreshPromise = null
let initialized = false

function applyRecordToCache(doc) {
  if (!doc) {
    cachedRecord = null
    cachedSummary = buildSummary(null)
    lastLoadedAt = Date.now()
    return
  }
  const lightBuf = extractBuffer(doc.lightLogo?.data)
  const darkBuf = extractBuffer(doc.darkLogo?.data)
  cachedRecord = {
    organizationName: doc.organizationName || '',
    lightLogo: lightBuf
      ? {
          data: lightBuf,
          mimeType: doc.lightLogo.mimeType || 'image/png',
          sizeBytes: lightBuf.length,
        }
      : null,
    darkLogo: darkBuf
      ? {
          data: darkBuf,
          mimeType: doc.darkLogo.mimeType || 'image/png',
          sizeBytes: darkBuf.length,
        }
      : null,
    version: doc.version || '',
    updatedAt: doc.updatedAt || null,
  }
  cachedSummary = buildSummary(cachedRecord)
  lastLoadedAt = Date.now()
}

async function getCollection() {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    return null
  }
  return mongoose.connection.db.collection(COLLECTION_NAME)
}

async function publishBrandingUpdate() {
  const redisSettings = Settings.redis?.pubsub || Settings.redis?.web
  if (!redisSettings) return
  let rclient
  try {
    rclient = redis.createClient(redisSettings)
    await rclient.publish(PUB_SUB_CHANNEL, String(Date.now()))
  } catch (err) {
    logger.warn({ err }, 'failed to publish workspace branding update')
  } finally {
    if (rclient) {
      try {
        await rclient.disconnect()
      } catch {
        // ignore disconnect failures
      }
    }
  }
}

const WorkspaceBrandingService = {
  async refreshCache() {
    if (refreshPromise) return refreshPromise
    refreshPromise = (async () => {
      try {
        const collection = await getCollection()
        if (!collection) return cachedSummary
        const doc = await collection.findOne({ _id: DOC_ID })
        applyRecordToCache(doc)
        return cachedSummary
      } catch (err) {
        logger.warn({ err }, 'failed to load workspace branding settings')
        return cachedSummary
      } finally {
        refreshPromise = null
      }
    })()
    return refreshPromise
  },

  async initialize() {
    if (initialized) return
    initialized = true
    await this.refreshCache()

    try {
      const pubSubClient = RedisWrapper.client('pubsub')
      await pubSubClient.subscribe(PUB_SUB_CHANNEL)
      const onMessage = channel => {
        if (channel === PUB_SUB_CHANNEL) {
          this.refreshCache().catch(err => {
            logger.warn({ err }, 'failed to refresh workspace branding cache')
          })
        }
      }
      pubSubClient.on('message', onMessage)
      addRequiredCleanupHandlerBeforeDrainingConnections(
        `pub-sub ${PUB_SUB_CHANNEL}`,
        async () => {
          pubSubClient.off?.('message', onMessage)
          await pubSubClient.unsubscribe(PUB_SUB_CHANNEL)
        }
      )
    } catch (err) {
      logger.warn(
        { err },
        'falling back to periodic refresh for workspace branding'
      )
    }
  },

  getCachedSummary() {
    if (Date.now() - lastLoadedAt > CACHE_TTL_MS && !refreshPromise) {
      this.refreshCache().catch(() => {})
    }
    return cachedSummary
  },

  async getBrandingSummary() {
    return await this.refreshCache()
  },

  async getLogoAsset(variant = 'light') {
    if (lastLoadedAt === 0 || Date.now() - lastLoadedAt > CACHE_TTL_MS) {
      await this.refreshCache()
    }
    if (!cachedRecord) return null
    const chosen =
      variant === 'dark'
        ? cachedRecord.darkLogo || cachedRecord.lightLogo
        : cachedRecord.lightLogo
    if (!chosen?.data) return null
    return {
      buffer: chosen.data,
      mimeType: chosen.mimeType,
      version: cachedRecord.version,
    }
  },

  async updateBranding({
    organizationName,
    logoDataUrl,
    logoDarkDataUrl,
    clearLogo,
    clearLogoDark,
    updatedBy,
  }) {
    const collection = await getCollection()
    if (!collection) {
      const err = new Error('Database connection unavailable')
      err.statusCode = 503
      throw err
    }

    const existing = await collection.findOne({ _id: DOC_ID })
    let nextLight = existing?.lightLogo || null
    let nextDark = existing?.darkLogo || null
    let nextName = existing?.organizationName || ''

    if (organizationName !== undefined) {
      nextName = sanitizeControlCharacters(String(organizationName)).trim().slice(0, 120)
    }
    if (clearLogo) {
      nextLight = null
    }
    if (clearLogoDark) {
      nextDark = null
    }
    if (logoDataUrl) {
      nextLight = parseAndValidateLogoDataUrl(logoDataUrl)
    }
    if (logoDarkDataUrl) {
      nextDark = parseAndValidateLogoDataUrl(logoDarkDataUrl)
    }

    const lightBuf = extractBuffer(nextLight?.data)
    const darkBuf = extractBuffer(nextDark?.data)
    const version = computeVersion(
      lightBuf ? { ...nextLight, data: lightBuf } : null,
      darkBuf ? { ...nextDark, data: darkBuf } : null,
      nextName
    )

    const updatedAt = new Date()
    const nextDoc = {
      _id: DOC_ID,
      organizationName: nextName,
      lightLogo: nextLight,
      darkLogo: nextDark,
      version,
      updatedAt,
      updatedBy: updatedBy || '',
    }

    await collection.replaceOne({ _id: DOC_ID }, nextDoc, { upsert: true })
    applyRecordToCache(nextDoc)
    await publishBrandingUpdate()
    return cachedSummary
  },

  async resetBranding(updatedBy) {
    const collection = await getCollection()
    if (collection) {
      await collection.deleteOne({ _id: DOC_ID })
    }
    applyRecordToCache(null)
    logger.info({ updatedBy }, 'workspace branding reset to default Overleaf logo')
    await publishBrandingUpdate()
    return cachedSummary
  },
}

export default WorkspaceBrandingService
