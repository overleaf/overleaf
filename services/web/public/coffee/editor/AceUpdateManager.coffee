define [
	"documentUpdater"
	"ace/range"
], () ->
	Range = require("ace/range").Range
	Modal = require("utils/Modal")
 
	class AceUpdateManager
		constructor: (@editor) ->
			@ide = @editor.ide

			guidGenerator=()->
				S4 = ()->
					return (((1+Math.random())*0x10000)|0).toString(16).substring(1)
				return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4())
			@window_id = guidGenerator()

			@bindToServerEvents()

		bindToServerEvents: () ->




			@ide.socket.on 'reciveTextUpdate', (updating_id, change) =>
				@ide.savingAreaManager.saved()
				if(@window_id == updating_id)
					return
				@ownChange = true
				doc = @editor.getDocument()
				documentUpdater.applyChange doc, change, Range, ()=>
					@ownChange = false

		bindToDocument: (doc_id, docLines, version) ->
			@current_doc_id = doc_id
			aceDoc = @editor.getDocument()
			aceDoc.on 'change', (change) =>
				if(!@ownChange)
					@ide.socket.emit 'sendUpdate',
						@current_doc_id, @window_id, change.data
