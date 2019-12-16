/* eslint-disable
    camelcase,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { assert } = require('chai')
const sinon = require('sinon')
const chai = require('chai')
const should = chai.should()
const { expect } = chai
const modulePath = '../../../app/js/BucketController.js'

describe('Settings', () =>
  describe('s3', () =>
    it('should use JSONified env var if present', function(done) {
      const s3_settings = {
        bucket1: {
          auth_key: 'bucket1_key',
          auth_secret: 'bucket1_secret'
        }
      }
      process.env.S3_BUCKET_CREDENTIALS = JSON.stringify(s3_settings)

      const settings = require('settings-sharelatex')
      expect(settings.filestore.s3BucketCreds).to.deep.equal(s3_settings)
      return done()
    })))
