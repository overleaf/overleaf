const Crypto = require('node:crypto')

/**
 * Creates an S3 client that uses MD5 checksums for DeleteObjects operations
 * https://github.com/aws/aws-sdk-js-v3/blob/main/supplemental-docs/MD5_FALLBACK.md
 */
const md5Middleware = (next, context) => async args => {
  if (context.commandName !== 'DeleteObjectsCommand') {
    return next(args)
  }

  const headers = args.request.headers

  // Remove any checksum headers added by default middleware
  // This ensures our Content-MD5 is the primary integrity check
  Object.keys(headers).forEach(header => {
    const lowerHeader = header.toLowerCase()
    if (
      lowerHeader.startsWith('x-amz-checksum-') ||
      lowerHeader.startsWith('x-amz-sdk-checksum-')
    ) {
      delete headers[header]
    }
  })

  if (args.request.body) {
    const bodyContent = Buffer.from(args.request.body)
    headers['Content-MD5'] = Crypto.createHash('md5')
      .update(bodyContent)
      .digest('base64')
  }

  return await next(args)
}

function addMd5Middleware(client) {
  // Add the middleware relative to the flexible checksums middleware
  // This ensures it runs after default checksums might be added, but before signing
  client.middlewareStack.add(md5Middleware, {
    step: 'build',
    toMiddleware: 'flexibleChecksumsMiddleware',
    name: 'addMD5ChecksumForDeleteObjects',
    tags: ['MD5_FALLBACK'],
  })
}

module.exports = {
  addMd5Middleware,
}
