define ['ide/editor/directives/cmEditor'], () ->
  describe 'cmEditor', () ->
    beforeEach(module('SharelatexApp'))

    beforeEach () ->
      @richTextInit = sinon.stub()
      window.Frontend = {
        richText: {
          init: @richTextInit
        }
      }

    it 'inits Rich Text', () ->
      inject ($compile, $rootScope) ->
        $compile('<div cm-editor></div>')($rootScope)
        expect(@richTextInit).to.have.been.called

    it 'attaches to CM', () ->
      inject ($compile, $rootScope) ->
        setValue = sinon.stub()
        @richTextInit.returns({ setValue: setValue })
        getSnapshot = sinon.stub()
        detachFromCM = sinon.stub()
        attachToCM = sinon.stub()
        $rootScope.sharejsDoc = {
          getSnapshot: getSnapshot
          detachFromCM: detachFromCM
          attachToCM: attachToCM
        }

        $compile('<div cm-editor sharejs-doc="sharejsDoc"></div>')($rootScope)
        $rootScope.$digest()

        expect(getSnapshot).to.have.been.called
        expect(setValue).to.have.been.called
        expect(detachFromCM).to.have.been.called
        expect(attachToCM).to.have.been.called

    it 'detaches from CM when destroyed', () ->
      inject ($compile, $rootScope) ->
        @richTextInit.returns({ setValue: sinon.stub() })
        detachFromCM = sinon.stub()
        $rootScope.sharejsDoc = {
          getSnapshot: sinon.stub()
          detachFromCM: detachFromCM
          attachToCM: sinon.stub()
        }

        $compile('<div cm-editor sharejs-doc="sharejsDoc"></div>')($rootScope)
        $rootScope.$digest()
        $rootScope.$broadcast('destroy')

        expect(detachFromCM).to.have.been.called
