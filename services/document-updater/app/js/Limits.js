module.exports = {
  // compute the total size of the document in chararacters, including newlines
  getTotalSizeOfLines(lines) {
    let size = 0
    for (const line of lines) {
      size += line.length + 1 // include the newline
    }
    return size
  },

  // check whether the total size of the document in characters exceeds the
  // maxDocLength.
  //
  // The estimated size should be an upper bound on the true size, typically
  // it will be the size of the JSON.stringified array of lines.  If the
  // estimated size is less than the maxDocLength then we know that the total
  // size of lines will also be less than maxDocLength.
  docIsTooLarge(estimatedSize, lines, maxDocLength) {
    if (estimatedSize <= maxDocLength) {
      return false // definitely under the limit, no need to calculate the total size
    }
    // calculate the total size, bailing out early if the size limit is reached
    let size = 0
    for (const line of lines) {
      size += line.length + 1 // include the newline
      if (size > maxDocLength) return true
    }
    // since we didn't hit the limit in the loop, the document is within the allowed length
    return false
  },

  /**
   * @param {StringFileRawData} raw
   * @param {number} maxDocLength
   */
  stringFileDataContentIsTooLarge(raw, maxDocLength) {
    let n = raw.content.length
    if (n <= maxDocLength) return false // definitely under the limit, no need to calculate the total size
    for (const tc of raw.trackedChanges ?? []) {
      if (tc.tracking.type !== 'delete') continue
      n -= tc.range.length
      if (n <= maxDocLength) return false // under the limit now, no need to calculate the exact size
    }
    return true
  },
}
