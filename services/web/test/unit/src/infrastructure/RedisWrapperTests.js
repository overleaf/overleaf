/* eslint-disable
    max-len,
    no-return-assign,
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
const modulePath = '../../../../app/src/infrastructure/RedisWrapper.js'
const SandboxedModule = require('sandboxed-module')

describe('RedisWrapper', function() {
  beforeEach(function() {
    this.settings = { redis: {} }
    this.redis = { createClient: sinon.stub() }
    return (this.RedisWrapper = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'settings-sharelatex': this.settings,
        'redis-sharelatex': this.redis
      }
    }))
  })

  describe('client', function() {
    it('should use the feature settings if present', function() {
      this.settings.redis = {
        my_feature: {
          port: '23456',
          host: 'otherhost',
          password: 'banana'
        }
      }
      this.RedisWrapper.client('my_feature')
      return this.redis.createClient
        .calledWith(this.settings.redis.my_feature)
        .should.equal(true)
    })

    it('should use the web settings if feature not present', function() {
      this.settings.redis = {
        web: {
          port: '43',
          host: 'otherhost',
          password: 'banana'
        }
      }
      this.RedisWrapper.client('my_feature')
      return this.redis.createClient
        .calledWith(this.settings.redis.web)
        .should.equal(true)
    })
  })
})
