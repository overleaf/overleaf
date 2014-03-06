define [
	"libs/backbone"
], ()->
	Diff = Backbone.Model.extend
		url: () ->
			"/project/#{@get("project_id")}/doc/#{@get("doc_id")}/diff?from=#{@get("from")}&to=#{@get("to")}"
