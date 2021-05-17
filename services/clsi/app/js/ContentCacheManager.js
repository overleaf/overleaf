/**
 * ContentCacheManager - maintains a cache of stream hashes from a PDF file
 */

const { callbackify } = require('util')
const fs = require('fs')
const crypto = require('crypto')
const Path = require('path')
const Settings = require('settings-sharelatex')

const MIN_CHUNK_SIZE = Settings.pdfCachingMinChunkSize

const START_OF_STREAM_MARKER = 'stream'
const END_OF_STREAM_MARKER = 'endstream'
const START_OF_STREAM_MARKER_LENGTH = START_OF_STREAM_MARKER.length
const END_OF_STREAM_MARKER_LENGTH = END_OF_STREAM_MARKER.length

/**
 *
 * @param {String} contentDir path to directory where content hash files are cached
 * @param {String} filePath the pdf file to scan for streams
 */
async function update(contentDir, filePath) {
  const stream = fs.createReadStream(filePath)
  const extractor = new PdfStreamsExtractor()
  const ranges = []
  const newRanges = []
  for await (const chunk of stream) {
    const pdfStreams = extractor.consume(chunk)
    for (const pdfStream of pdfStreams) {
      if (pdfStream.end - pdfStream.start < MIN_CHUNK_SIZE) continue
      const hash = pdfStreamHash(pdfStream.buffers)
      const range = { start: pdfStream.start, end: pdfStream.end, hash }
      ranges.push(range)
      if (await writePdfStream(contentDir, hash, pdfStream.buffers)) {
        newRanges.push(range)
      }
    }
  }
  return [ranges, newRanges]
}

class PdfStreamsExtractor {
  constructor() {
    this.fileIndex = 0
    this.inStream = false
    this.streamStartIndex = 0
    this.buffers = []
    this.lastChunk = Buffer.alloc(0)
  }

  consume(chunk) {
    let chunkIndex = 0
    const pdfStreams = []
    chunk = Buffer.concat([this.lastChunk, chunk])
    while (true) {
      if (!this.inStream) {
        // Not in a stream, look for stream start
        const index = chunk.indexOf(START_OF_STREAM_MARKER, chunkIndex)
        if (index === -1) {
          // Couldn't find stream start
          break
        }
        // Found stream start, start a stream
        this.inStream = true
        this.streamStartIndex = this.fileIndex + index
        chunkIndex = index
      } else {
        // In a stream, look for stream end
        const index = chunk.indexOf(END_OF_STREAM_MARKER, chunkIndex)
        if (index === -1) {
          break
        }
        // add "endstream" part
        const endIndex = index + END_OF_STREAM_MARKER_LENGTH
        this.buffers.push(chunk.slice(chunkIndex, endIndex))
        pdfStreams.push({
          start: this.streamStartIndex,
          end: this.fileIndex + endIndex,
          buffers: this.buffers
        })
        this.inStream = false
        this.buffers = []
        chunkIndex = endIndex
      }
    }

    const remaining = chunk.length - chunkIndex
    const nextMarkerLength = this.inStream
      ? END_OF_STREAM_MARKER_LENGTH
      : START_OF_STREAM_MARKER_LENGTH
    if (remaining > nextMarkerLength) {
      const retainMarkerSection = chunk.length - nextMarkerLength
      if (this.inStream) {
        this.buffers.push(chunk.slice(chunkIndex, retainMarkerSection))
      }
      this.lastChunk = chunk.slice(retainMarkerSection)
      this.fileIndex += retainMarkerSection
    } else {
      this.lastChunk = chunk.slice(chunkIndex)
      this.fileIndex += chunkIndex
    }
    return pdfStreams
  }
}

function pdfStreamHash(buffers) {
  const hash = crypto.createHash('sha256')
  for (const buffer of buffers) {
    hash.update(buffer)
  }
  return hash.digest('hex')
}

async function writePdfStream(dir, hash, buffers) {
  const filename = Path.join(dir, hash)
  try {
    await fs.promises.stat(filename)
    // The file exists. Do not rewrite the content.
    // It would change the modified-time of the file and hence invalidate the
    //  ETags used for client side caching via browser internals.
    return false
  } catch (e) {}
  const file = await fs.promises.open(filename, 'w')
  if (Settings.enablePdfCachingDark) {
    // Write an empty file in dark mode.
    buffers = []
  }
  try {
    for (const buffer of buffers) {
      await file.write(buffer)
    }
  } finally {
    await file.close()
  }
  return true
}

module.exports = { update: callbackify(update) }
