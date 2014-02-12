define [
	"utils/Modal"
	"libs/backbone"
], (Modal) ->
	HistoryView = Backbone.View.extend
		template : $("#revisionAreaTemplate").html()

		events :
			"click #enableVersioning" : "enableVersioning"
			"click #take-snapshot" : "takeSnapshot"

		render : ->
			@$el.html(@template)
			return this

		setHistoryAreaToDisplayHistory: ->
			@$("#historyAreaWrapper").show()
			@$("#enableVersioningMessage").hide()

		setHistoryAreaToDisplayEnableVersioning: ->
			@$("#historyAreaWrapper").hide()
			@$("#enableVersioningMessage").show()

		enableVersioning: -> @options.manager.enableVersioning()

		takeSnapshot: ->
			Modal.createModal
				title: "Snapshot comment"
				message: $("#snapshotCommentTemplate").html()
				buttons: [{
					text: "Cancel"
				},{
					text: "Take Snapshot"
					class: "btn-primary"
					callback: () =>
						@options.manager.takeSnapshot(
							$("#snapshotComment").val()
						)
				}]
