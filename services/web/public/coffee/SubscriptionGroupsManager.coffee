require [
	"libs/mustache"
	"./main"
	"libs/underscore"
], (m)->
	$(document).ready ->

		tableRowTemplate = '''
			<tr>
				<td> <input type="checkbox"></td>
				<td> {{ email }} </td>
				<td> {{ first_name }} {{ last_name }} </td>
				<td> {{ !holdingAccount }} </td>
				<td>
					<input type="hidden" name="user_id" value="{{user_id}}" class="user_id">
				</td>
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

		removeUsers = (e)->
			selectedUserRows = $('td input:checked').closest('tr').find(".user_id")
			selectedUserRows.each (index, userRow)->
				user_id = $(userRow).val()
				$.ajax
					url: "/subscription/group/user/#{user_id}"
					type: 'DELETE'
					data:
						_csrf: csrfToken
					success: ->
						$(userRow).parents("tr").fadeOut(250)



		$form.on 'keypress', (e)->
			if(e.keyCode == 13)
				addUser(e)

		$form.find(".addUser").on 'click', addUser

		$('#deleteUsers').on 'click', removeUsers
