define ['utils/EventEmitter'], (EventEmitter) ->
  describe 'EventEmitter', () ->
    beforeEach () ->
      @eventEmitter = new EventEmitter

    it 'calls listeners', () ->
      cb1 = sinon.stub()
      cb2 = sinon.stub()
      @eventEmitter.on 'foo', cb1
      @eventEmitter.on 'bar', cb2

      @eventEmitter.trigger 'foo'

      expect(cb1).to.have.been.called
      expect(cb2).to.not.have.been.called

    it 'calls multiple listeners', () ->
      cb1 = sinon.stub()
      cb2 = sinon.stub()
      @eventEmitter.on 'foo', cb1
      @eventEmitter.on 'foo', cb2

      @eventEmitter.trigger 'foo'

      expect(cb1).to.have.been.called
      expect(cb2).to.have.been.called

    it 'calls listeners with namespace', () ->
      cb1 = sinon.stub()
      cb2 = sinon.stub()
      @eventEmitter.on 'foo', cb1
      @eventEmitter.on 'foo.bar', cb2

      @eventEmitter.trigger 'foo'

      expect(cb1).to.have.been.called
      expect(cb2).to.have.been.called

    it 'removes listeners', () ->
      cb = sinon.stub()
      @eventEmitter.on 'foo', cb
      @eventEmitter.off 'foo'

      @eventEmitter.trigger 'foo'

      expect(cb).to.not.have.been.called

    it 'removes namespaced listeners', () ->
      cb = sinon.stub()
      @eventEmitter.on 'foo.bar', cb
      @eventEmitter.off 'foo.bar'

      @eventEmitter.trigger 'foo'

      expect(cb).to.not.have.been.called

    it 'does not remove unnamespaced listeners if off called with namespace', () ->
      cb1 = sinon.stub()
      cb2 = sinon.stub()
      @eventEmitter.on 'foo', cb1
      @eventEmitter.on 'foo.bar', cb2
      @eventEmitter.off 'foo.bar'

      @eventEmitter.trigger 'foo'

      expect(cb1).to.have.been.called
      expect(cb2).to.not.have.been.called
