const { Stream } = require('pdfjs-dist/lib/core/stream')
const { MissingDataException } = require('pdfjs-dist/lib/core/core_utils')

const BUF_SIZE = 1024 // read from the file in 1024 byte pages

class FSStream extends Stream {
  constructor(fh, start, length, dict, cachedBytes, checkDeadline) {
    const nonEmptyDummyBuffer = Buffer.alloc(1, 0)
    super(nonEmptyDummyBuffer, start, length, dict)
    delete this.bytes
    this.fh = fh
    this.checkDeadline = checkDeadline
    this.cachedBytes = cachedBytes || []
  }

  get length() {
    return this.end - this.start
  }

  get isEmpty() {
    return this.length === 0
  }

  // Manage cached reads from the file

  requestRange(begin, end) {
    this.checkDeadline(`request range ${begin} - ${end}`)
    // expand small ranges to read a larger amount
    if (end - begin < BUF_SIZE) {
      end = begin + BUF_SIZE
    }
    end = Math.min(end, this.length)
    // keep a cache of previous reads with {begin,end,buffer} values
    const result = {
      begin,
      end,
      buffer: Buffer.alloc(end - begin, 0),
    }
    this.cachedBytes.push(result)
    return this.fh.read(result.buffer, 0, end - begin, begin)
  }

  _ensureGetPos(pos) {
    const found = this.cachedBytes.find(x => {
      return x.begin <= pos && pos < x.end
    })
    if (!found) {
      throw new MissingDataException(pos, pos + 1)
    }
    return found
  }

  _ensureGetRange(begin, end) {
    end = Math.min(end, this.length) // BG: handle overflow case
    const found = this.cachedBytes.find(x => {
      return x.begin <= begin && end <= x.end
    })
    if (!found) {
      throw new MissingDataException(begin, end)
    }
    return found
  }

  _readByte(found, pos) {
    return found.buffer[pos - found.begin]
  }

  _readBytes(found, pos, end) {
    return found.buffer.subarray(pos - found.begin, end - found.begin)
  }

  // handle accesses to the bytes

  ensureByte(pos) {
    this._ensureGetPos(pos) // may throw a MissingDataException
  }

  getByte() {
    const pos = this.pos
    if (this.pos >= this.end) {
      return -1
    }
    const found = this._ensureGetPos(pos)
    return this._readByte(found, this.pos++)
  }

  // BG: for a range, end is not included (see Buffer.subarray for example)

  ensureBytes(length, forceClamped = false) {
    const pos = this.pos
    this._ensureGetRange(pos, pos + length)
  }

  getBytes(length, forceClamped = false) {
    const pos = this.pos
    const strEnd = this.end

    const found = this._ensureGetRange(pos, pos + length)
    if (!length) {
      const subarray = this._readBytes(found, pos, strEnd)
      // `this.bytes` is always a `Uint8Array` here.
      return forceClamped ? new Uint8ClampedArray(subarray) : subarray
    }
    let end = pos + length
    if (end > strEnd) {
      end = strEnd
    }
    this.pos = end
    const subarray = this._readBytes(found, pos, end)
    // `this.bytes` is always a `Uint8Array` here.
    return forceClamped ? new Uint8ClampedArray(subarray) : subarray
  }

  getByteRange() {
    // BG: this isn't needed as far as I can tell
    throw new Error('not implemented')
  }

  reset() {
    this.pos = this.start
  }

  moveStart() {
    this.start = this.pos
  }

  makeSubStream(start, length, dict = null) {
    this.checkDeadline(`make sub stream start=${start}/length=${length}`)
    // BG: had to add this check for null length, it is being called with only
    // the start value at one point in the xref decoding. The intent is clear
    // enough
    // - a null length means "to the end of the file" -- not sure how it is
    //   working in the existing pdfjs code without this.
    if (!length) {
      length = this.end - start
    }
    return new FSStream(
      this.fh,
      start,
      length,
      dict,
      this.cachedBytes,
      this.checkDeadline
    )
  }
}

module.exports = { FSStream }
