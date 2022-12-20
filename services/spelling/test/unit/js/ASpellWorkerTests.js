import sinon from 'sinon'
import { expect } from 'chai'
import esmock from 'esmock'
import EventEmitter from 'events'

describe('ASpellWorker', function () {
  beforeEach(async function () {
    this.pipe = {
      stdout: new EventEmitter(),
      stderr: { on: sinon.stub() },
      stdin: { on: sinon.stub() },
      on: sinon.stub(),
      pid: 12345,
    }
    this.pipe.stdout.setEncoding = sinon.stub()
    this.child_process = {
      spawn: sinon.stub().returns(this.pipe),
    }
    const { ASpellWorker } = await esmock('../../../app/js/ASpellWorker', {
      '@overleaf/metrics': {
        gauge() {},
        inc() {},
      },
      child_process: this.child_process,
    })
    this.ASpellWorker = ASpellWorker
  })

  describe('creating a worker', function () {
    beforeEach(function () {
      this.worker = new this.ASpellWorker('en')
    })

    describe('with normal aspell output', function () {
      beforeEach(function () {
        this.callback = this.worker.callback = sinon.stub()
        this.pipe.stdout.emit('data', '& hello\n')
        this.pipe.stdout.emit('data', '& world\n')
        this.pipe.stdout.emit('data', 'en\n')
        this.pipe.stdout.emit('data', '& goodbye')
      })

      it('should call the callback', function () {
        expect(this.callback.called).to.equal(true)
        expect(
          this.callback.calledWith(null, '& hello\n& world\nen\n')
        ).to.equal(true)
      })
    })

    describe('with the aspell end marker split across chunks', function () {
      beforeEach(function () {
        this.callback = this.worker.callback = sinon.stub()
        this.pipe.stdout.emit('data', '& hello\n')
        this.pipe.stdout.emit('data', '& world\ne')
        this.pipe.stdout.emit('data', 'n\n')
        this.pipe.stdout.emit('data', '& goodbye')
      })

      it('should call the callback', function () {
        expect(this.callback.called).to.equal(true)
        expect(
          this.callback.calledWith(null, '& hello\n& world\nen\n')
        ).to.equal(true)
      })
    })

    describe('with the aspell end marker newline split across chunks', function () {
      beforeEach(function () {
        this.callback = this.worker.callback = sinon.stub()
        this.pipe.stdout.emit('data', '& hello\n')
        this.pipe.stdout.emit('data', '& world\n')
        this.pipe.stdout.emit('data', 'en')
        this.pipe.stdout.emit('data', '\n& goodbye')
      })

      it('should call the callback', function () {
        expect(this.callback.called).to.equal(true)
        expect(this.callback.calledWith(null, '& hello\n& world\nen')).to.equal(
          true
        )
      })
    })

    describe('with everything split across chunks', function () {
      beforeEach(function () {
        this.callback = this.worker.callback = sinon.stub()
        '& hello\n& world\nen\n& goodbye'.split('').forEach(x => {
          this.pipe.stdout.emit('data', x)
        })
      })

      it('should call the callback', function () {
        expect(this.callback.called).to.equal(true)
        expect(this.callback.calledWith(null, '& hello\n& world\nen')).to.equal(
          true
        )
      })
    })
  })
})
