const chai = require('chai')
const { expect } = chai
const SandboxedModule = require('sandboxed-module')

describe('Settings', function () {
  describe('s3', function () {
    it('should use JSONified env var if present', function () {
      const s3Settings = {
        bucket1: {
          auth_key: 'bucket1_key',
          auth_secret: 'bucket1_secret',
        },
      }
      process.env.S3_BUCKET_CREDENTIALS = JSON.stringify(s3Settings)
      const settings = SandboxedModule.require('@overleaf/settings', {
        globals: { console, process },
      })
      expect(settings.filestore.s3.bucketCreds).to.deep.equal(s3Settings)
    })
  })
})
