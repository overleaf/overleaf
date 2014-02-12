require [
	"main"
	"libs/jquery.tablesorter"
], ()->
	$(document).ready ()->
		$('#connected-users').tablesorter()

		$('button#disconnectAll').click (event)->
			event.preventDefault()
			$.ajax
				url: "/admin/dissconectAllUsers",
				type:'POST',
				data:
					_csrf: $(@).data("csrf")
				success: (data)->
			
		$('button#closeEditor').click (event)->
			event.preventDefault()
			$.ajax
				url: "/admin/closeEditor",
				type:'POST',
				data:
					_csrf: $(@).data("csrf")
				success: (data)->

		$('button#pollTpds').click (event)->
			event.preventDefault()
			$.ajax
				url: "/admin/pollUsersWithDropbox",
				type:'POST',
				data:
					_csrf: $(@).data("csrf")
				success: (data)->
