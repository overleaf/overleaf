/* eslint-disable
    handle-callback-err,
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
const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = '../../../../app/js/DiffCodec.js'
const SandboxedModule = require('sandboxed-module')

describe('DiffCodec', function () {
  beforeEach(function () {
    this.callback = sinon.stub()
    return (this.DiffCodec = SandboxedModule.require(modulePath))
  })

  return describe('diffAsShareJsOps', function () {
    it('should insert new text correctly', function (done) {
      this.before = ['hello world']
      this.after = ['hello beautiful world']
      return this.DiffCodec.diffAsShareJsOp(
        this.before,
        this.after,
        (error, ops) => {
          expect(ops).to.deep.equal([
            {
              i: 'beautiful ',
              p: 6,
            },
          ])
          return done()
        }
      )
    })

    it('should shift later inserts by previous inserts', function (done) {
      this.before = ['the boy played with the ball']
      this.after = ['the tall boy played with the red ball']
      return this.DiffCodec.diffAsShareJsOp(
        this.before,
        this.after,
        (error, ops) => {
          expect(ops).to.deep.equal([
            { i: 'tall ', p: 4 },
            { i: 'red ', p: 29 },
          ])
          return done()
        }
      )
    })

    it('should delete text correctly', function (done) {
      this.before = ['hello beautiful world']
      this.after = ['hello world']
      return this.DiffCodec.diffAsShareJsOp(
        this.before,
        this.after,
        (error, ops) => {
          expect(ops).to.deep.equal([
            {
              d: 'beautiful ',
              p: 6,
            },
          ])
          return done()
        }
      )
    })

    return it('should shift later deletes by the first deletes', function (done) {
      this.before = ['the tall boy played with the red ball']
      this.after = ['the boy played with the ball']
      return this.DiffCodec.diffAsShareJsOp(
        this.before,
        this.after,
        (error, ops) => {
          expect(ops).to.deep.equal([
            { d: 'tall ', p: 4 },
            { d: 'red ', p: 24 },
          ])
          return done()
        }
      )
    })
  })
})
