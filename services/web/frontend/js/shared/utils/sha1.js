/**
 * From https://github.com/pvorb/node-sha1/blob/master/sha1.js
 * Copyright © 2009, Jeff Mott. All rights reserved.
 * Copyright © 2011, Paul Vorbach. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice, this
 *    list of conditions and the following disclaimer in the documentation and/or
 *    other materials provided with the distribution.
 * 3. Neither the name Crypto-JS nor the names of its contributors may be used to
 *    endorse or promote products derived from this software without specific prior
 *    written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
 * ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { wordsToBytes, bytesToWords } from './crypto'

export function generateSHA1Hash(inputString) {
  const encoder = new TextEncoder()
  const uint8Array = encoder.encode(inputString)

  const m = bytesToWords(uint8Array)
  const l = uint8Array.length * 8
  const w = []
  let H0 = 1732584193
  let H1 = -271733879
  let H2 = -1732584194
  let H3 = 271733878
  let H4 = -1009589776

  // Padding
  m[l >> 5] |= 0x80 << (24 - (l % 32))
  m[(((l + 64) >>> 9) << 4) + 15] = l

  for (let i = 0; i < m.length; i += 16) {
    const a = H0
    const b = H1
    const c = H2
    const d = H3
    const e = H4

    for (let j = 0; j < 80; j++) {
      if (j < 16) w[j] = m[i + j]
      else {
        const n = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16]
        w[j] = (n << 1) | (n >>> 31)
      }

      const t =
        ((H0 << 5) | (H0 >>> 27)) +
        H4 +
        (w[j] >>> 0) +
        (j < 20
          ? ((H1 & H2) | (~H1 & H3)) + 1518500249
          : j < 40
            ? (H1 ^ H2 ^ H3) + 1859775393
            : j < 60
              ? ((H1 & H2) | (H1 & H3) | (H2 & H3)) - 1894007588
              : (H1 ^ H2 ^ H3) - 899497514)

      H4 = H3
      H3 = H2
      H2 = (H1 << 30) | (H1 >>> 2)
      H1 = H0
      H0 = t
    }

    H0 += a
    H1 += b
    H2 += c
    H3 += d
    H4 += e
  }

  const result = wordsToBytes([H0, H1, H2, H3, H4])

  // Convert array of bytes to a hex string
  // padStart is used to ensure numbers that are
  // less than 16 will still be converted into the two-character format
  // For example:
  // "5" => "05"
  // "a" => "0a"
  // "ff" => "ff"
  return result.map(b => b.toString(16).padStart(2, '0')).join('')
}
