#!/usr/bin/env node

// @ts-check

import minimist from 'minimist'
import { fileURLToPath } from 'node:url'

/**
 * Converts an integer to its corresponding IPv4 address string representation
 *
 * @param {number} int
 * @returns {string}
 */
const intToIp = int =>
  [
    (int >>> 24) & 0xff,
    (int >>> 16) & 0xff,
    (int >>> 8) & 0xff,
    int & 0xff,
  ].join('.')

/**
 * Convert CIDR to IP range
 *
 * @param {string} cidr
 * @returns {{min: string, max: string}}
 */
const cidrToRange = cidr => {
  const [ip, prefixLength] = cidr.split('/')
  const prefix = parseInt(prefixLength)

  // Convert IP to 32-bit integer
  const ipParts = ip.split('.').map(part => parseInt(part))
  const ipInt =
    (ipParts[0] << 24) + (ipParts[1] << 16) + (ipParts[2] << 8) + ipParts[3]

  // Calculate network mask
  const mask = (0xffffffff << (32 - prefix)) >>> 0

  // Calculate network and broadcast addresses
  const network = (ipInt & mask) >>> 0
  const broadcast = (network | (0xffffffff >>> prefix)) >>> 0

  return {
    min: intToIp(network),
    max: intToIp(broadcast),
  }
}

/**
 * Converts an array of CIDR ranges into a single string representation.
 * Each CIDR range is converted into its corresponding minimum and maximum IP range,
 * formatted as "min..max". All resultant ranges are joined by a comma.
 *
 * @param {string[]} cidrRanges - An array of CIDR range strings to be converted.
 * @returns {string} A string representation of the converted ranges where each
 * range is formatted as "min..max" and joined by commas.
 */
export const convertCidrRanges = cidrRanges =>
  cidrRanges
    .map(cidr => {
      const range = cidrToRange(cidr)
      return `${range.min}..${range.max}`
    })
    .join(',')

// Only run CLI if this file is executed directly
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const argv = minimist(process.argv.slice(2))

  if (argv._.length === 0) {
    console.log('Usage: node scripts/ip_matcher_ranges.mjs <cidr1> [cidr2] ...')
    console.log(
      'Example: node scripts/ip_matcher_ranges.mjs 192.168.1.0/24 10.0.0.0/8'
    )
    process.exit(1)
  }

  console.log(convertCidrRanges(argv._))
}
