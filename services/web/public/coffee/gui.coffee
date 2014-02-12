require [
	"libs/jquery.storage"
	"libs/bootstrap/bootstrap2full"
], ()->
		$('tr.clickable').click (event)->
			window.location = $(event.target).closest('tr').attr("href")
		
		$('.dropdown-toggle').dropdown()
		#        $('.tabs').tab('show')

		$(".carousel").carousel()

		$("#scribtexModal").modal()

		return

