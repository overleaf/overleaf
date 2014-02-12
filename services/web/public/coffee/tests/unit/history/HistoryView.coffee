define [
	"libs/chai"
	"history/HistoryView"
	"utils/Modal"
	"libs/sinon"
], (chai, HistoryView, Modal) ->
	should = chai.should()

	describe "HistoryView", ->
		beforeEach ->
			@el = $("<div/>")
			$("#test-area").append(@el)
			@historyManager =
				takeSnapshot: sinon.stub()
			@historyView = new HistoryView el : @el, manager: @historyManager

		describe "takeSnapshot", ->
			beforeEach ->
				sinon.spy Modal, "createModal"
				@historyView.takeSnapshot()

			afterEach ->
				$(".modal").remove()
				Modal.createModal.restore()

			it "should display a modal asking for a comment", ->
				Modal.createModal.called.should.equal true
				options = Modal.createModal.args[0][0]
				should.exist options.title
				should.exist options.message
				options.buttons[0].text.should.equal "Cancel"
				options.buttons[1].text.should.equal "Take Snapshot"

			describe "user clicks ok", ->
				beforeEach ->
					@message = "what a wonderful message"
					$("#snapshotComment").val(@message)
					$(".modal-footer a.btn-primary").click()

				it "should call takeSnapshot with the message", ->
					@historyManager.takeSnapshot.calledWith(@message)
						.should.equal true
					
				
				

		
