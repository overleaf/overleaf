define [
	"libs/backbone"
	"libs/mustache"
	"libs/bootstrap/bootstrap2full"
], () ->
	Modal = Backbone.View.extend {
		templates:
			modal: $("#genericModalTemplate").html()
			button: $("#genericModalButtonTemplate").html()

		initialize: () ->
			@render()
			@options.buttons ||= []
			self = @
			for buttonOptions in @options.buttons
				do (buttonOptions) ->
					button = $(Mustache.to_html self.templates.button, buttonOptions)
					self.$(".modal-footer").prepend button
					button.on "click", (e) ->
						e.preventDefault()
						if buttonOptions.callback?
							buttonOptions.callback()
						self.remove()

			@$el.modal
				# make sure we control when the modal is hidden
				keyboard: false
				backdrop: "static"

			@$el.on "hidden", () => @remove()

			if @options.clearBackdrop
				$(".modal-backdrop").addClass("clear-modal-backdrop")

			@$el.find('input').on "keydown", (event)->
				code = event.keyCode || event.which
				if code == 13
					self.$el.find('.btn-primary').click()

			@$el.find('input').focus()


		remove: () ->
			@$el.modal("hide")
			Backbone.View.prototype.remove.call(this)

		render: () ->
			@setElement $(
				Mustache.to_html @templates.modal, @options
			)
			if @options.el?
				@$(".message").append @options.el
			$(document.body).append(@$el)
	}, {
		createModal: (options) ->
			new Modal(options)
	}

	return Modal

		


			
			
	
