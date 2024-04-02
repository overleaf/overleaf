const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = '../../../../app/js/DiffCodec.js'
const SandboxedModule = require('sandboxed-module')

describe('DiffCodec', function () {
  beforeEach(function () {
    this.callback = sinon.stub()
    this.DiffCodec = SandboxedModule.require(modulePath)
  })

  describe('diffAsShareJsOps', function () {
    it('should insert new text correctly', function () {
      this.before = ['hello world']
      this.after = ['hello beautiful world']
      const ops = this.DiffCodec.diffAsShareJsOp(this.before, this.after)
      expect(ops).to.deep.equal([
        {
          i: 'beautiful ',
          p: 6,
        },
      ])
    })

    it('should shift later inserts by previous inserts', function () {
      this.before = ['the boy played with the ball']
      this.after = ['the tall boy played with the red ball']
      const ops = this.DiffCodec.diffAsShareJsOp(this.before, this.after)
      expect(ops).to.deep.equal([
        { i: 'tall ', p: 4 },
        { i: 'red ', p: 29 },
      ])
    })

    it('should delete text correctly', function () {
      this.before = ['hello beautiful world']
      this.after = ['hello world']
      const ops = this.DiffCodec.diffAsShareJsOp(this.before, this.after)
      expect(ops).to.deep.equal([
        {
          d: 'beautiful ',
          p: 6,
        },
      ])
    })

    it('should shift later deletes by the first deletes', function () {
      this.before = ['the tall boy played with the red ball']
      this.after = ['the boy played with the ball']
      const ops = this.DiffCodec.diffAsShareJsOp(this.before, this.after)
      expect(ops).to.deep.equal([
        { d: 'tall ', p: 4 },
        { d: 'red ', p: 24 },
      ])
    })
  })
})
