require [
	"libs/mustache"
	"./main"
	"libs/underscore"
], (m)->
	$(document).ready ->

		tableRowTemplate = '''
			<tr>
				<td> {{ email }} </td>
				<td> {{ first_name }} {{ last_name }} </td>
				<td> {{ !holdingAccount }} </td>
				<td><button id="{{_id}}"" class="btn btn-danger">Remove</button></td>
			</tr>
		'''

		window.temp = tableRowTemplate

		$form = $('form#addUserToGroup')

		addUser = (e)->

			parseEmails = (emailsString)->
				regexBySpaceOrComma = /[\s,]+/
				emails = emailsString.split(regexBySpaceOrComma)
				emails = _.map emails, (email)->
					email = email.trim()
				emails = _.select emails, (email)->
					email.indexOf("@") != -1
				return emails


			sendNewUserToServer = (email)->
				$.ajax
					url: "/subscription/group/user"
					type: 'POST'
					data:
						email: email
						_csrf: $("input[name=_csrf]").val()
					success: (data)->
						if data.limitReached
							alert("You have reached your maximum number of members")
						else
							renderNewUserInList data.user

			renderNewUserInList = (user)->
				html = Mustache.to_html(tableRowTemplate, user)
				$('#userList').append(html)

			e.preventDefault()
			val = $form.find("input[name=email]").val()
			emails = parseEmails(val)
			emails.forEach (email)->
				sendNewUserToServer(email)
			$form.find("input").val('')

		removeUser = (e)->
			button = $(e.target)
			user_id = button.attr("id")
			$.ajax
				url: "/subscription/group/user/#{user_id}"
				type: 'DELETE'
				data:
					_csrf: csrfToken
				success: ->
					button.parents("tr").fadeOut(250)

		$form.on 'keypress', (e)->
			if(e.keyCode == 13)
				addUser(e)

		$form.find(".addUser").on 'click', addUser

		$('table').on 'click', '.btn-danger', removeUser
