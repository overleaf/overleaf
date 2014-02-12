define [
	"utils/Modal"
], (Modal) ->
	describe "Modal", ->
		describe "initialization", ->
			beforeEach ->
				@modal = Modal.createModal
					title: "Test modal"
					message : "Test modal message"
					buttons: [{
						text  : "OK"
						class : "btn-primary"
					}, {
						text  : "Cancel"
						class : "btn-danger"
					}]
			afterEach ->
				@modal.remove()

			it "should display the modal", ->
				@modal.$el.is(":visible").should.equal true

			it "should include the buttons in reverse order", ->
				buttons = @modal.$(".modal-footer a")
				$(buttons[0]).text().should.equal "Cancel"
				$(buttons[0]).hasClass("btn-danger").should.equal true
				$(buttons[1]).text().should.equal "OK"
				$(buttons[1]).hasClass("btn-primary").should.equal true

			it "should include the title", ->
				@modal.$("h3").text().should.equal "Test modal"

			it "should include the message", ->
				@modal.$(".message").text().should.equal "Test modal message"
	
		describe "clicking buttons", ->
			beforeEach ->
				@callbackCalled = false
				@modal = Modal.createModal
					title: "Test modal"
					message : "Test modal message"
					buttons: [{
						text  : "OK"
						class : "btn-primary"
						callback : () =>
							@callbackCalled = true
					}]
				@modal.$(".modal-footer a").click()
			
			it "should call the callback", ->
				@callbackCalled.should.equal true

			it "should remove the modal", ->
				@modal.$el.is(":visible").should.equal false
				@modal.$el.parent().length.should.equal 0

