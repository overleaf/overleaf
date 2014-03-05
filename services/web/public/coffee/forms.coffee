require [
	"libs/jquery.validate"
	"libs/fineuploader"
	"libs/bootstrap/bootstrap2full"
], ()->

	$().ready ->
		url = document.location.toString();
		if (url.match('#'))
			$('.nav-tabs a[href=#'+url.split('#')[1]+']').tab('show')
		$('.nav-tabs a').on 'shown', (e)->
			window.location.hash = e.target.hash

	shortRegisterFormRules =
		rules:
			redir:
				required:false
			email:
				required: true
				email: true
			password:
				required: true

		errorElement: 'div'
		submitHandler: (form)->
			formData = $(form).serialize()
			$.ajax
				url: "/register",
				type:'POST',
				data: formData,
				success: (data)->
					if data.message?
						new Message data.message
						ga('send', 'event', 'register', 'failure')
					else
						ga('send', 'event', 'register', 'success')
						window.location = data.redir || "/project"
				

	$('#registerFormShort').validate shortRegisterFormRules

	$("#registerFormShort").show()

	passwordFormInited = false
	$('a#changePassword').click (event)->
		event.preventDefault()
		$modal = $ '#changePasswordModal'
		$modal.modal
			backdrop:true
			show:true
			keyboard:true

		if !passwordFormInited
			passwordFormInited = true
			$modal.find('.cancel').click (e)->
				$modal.modal('hide')
			
			$modal.find('form#changePasswordForm').submit (e)->
				e.preventDefault()
				formData = $('form#changePasswordForm').serialize()
				$.ajax
					url: "/user/password/update"
					type:'POST'
					data: formData
					success: (data)->
						if(data.message)
							new Message data.message
						$modal.modal('hide')

	$('form#loginForm').submit (event)->
		event.preventDefault()
		formData = $(this).serialize()
		$.ajax
			url: "/login"
			type:'POST'
			data: formData
			error: (data)->
				if data.responseText
					message = JSON.parse(data.responseText).message
					new Message message
			success: (data)->
				if data.message
					new Message data.message
					ga('send', 'event', 'login', 'failure')
				else if data.redir
					window.location.href = data.redir
					ga('send', 'event', 'login', 'success')
				else
					ga('send', 'event', 'login', 'success')
					window.location.href = '/project'

	$('form#passwordReset').submit (event)->
		event.preventDefault()
		formData = $(this).serialize()
		$.ajax
			url: "/user/passwordReset"
			type:'POST'
			data: formData
			success: (data)->
				if data.message
					new Message data.message
				else if data.redir
					window.location.href = data.redir
				else
					window.location.href = '/'


	$('a#deleteUserAccount').click (e)->
		redirect = ->
			window.location.href = '/'


		$modal = $('#deleteUserAccountModal')
		$modal.modal
			backdrop:true
			show:true
			keyboard:true

		$modal.find('.cancel').click (e)->
			$modal.modal('hide')
			
		$confirm = $modal.find('.btn-danger')

		$modal.on 'hide', ->
			$confirm.off 'click'
		
		$confirm.click (e) =>
			e.preventDefault()
			val = $modal.find(".inputmodal").val()
			if val == "Delete"
				$modal.modal('hide')
				$.ajax
					url: '/user'
					type: 'DELETE'
					data:
						_csrf: $(@).data("csrf")
					success: (data)->
						new Message {title:"Deleted", text:" : Your account has been deleted"}
						setTimeout redirect, 10000
			else
				$modal.find(".inputmodal").val("")
				alert "You did not type 'Delete', please try again"


	$('a#unsubscribeFromNewsletter').click (e)->
		$.ajax
			url: '/user/newsletter/unsubscribe'
			type: 'DELETE'
			data:
				_csrf: $(@).data("csrf")
			success: (data)->
				new Message {title:"Unsubscribed", text:" : You have been unsubscribed from the newsletter"}

	$('form#userSettings').validate
		rules:
			newPassword1:
				minlength: 1
			newPassword2:
				equalTo: "#newPassword1"
		messages:
			newPassword1:
				minlength: "1 character minimum"
			newPassword2:
				equalTo: "Passwords don't match"
		highlight: (element, errorClass, validClas)->
			$(element).parents("div[class='clearfix']").addClass("error")
							 
		unhighlight: (element, errorClass, validClass)->
			$(element).parents(".error").removeClass("error")
		errorElement: 'div'
		submitHandler: (form)->
			formData = $(form).serialize()
			$.ajax
				url: '/user/settings'
				type:'POST'
				data: formData
				success: (data)->
					if data.message
						displayMessage data
					else
						new Message {text:"Your settings have been saved"}

	class Message
		constructor: (message)->
			aClose = $('<a></a>').addClass('close').attr('href','#').text('x')
			pTitle = $('<strong></strong>').text(message.title)
			pText = $('<span></span>').html(' '+message.text)
			div = $('<div></div>')
				.addClass('alert')
				.append(aClose)
				.append(pTitle)
				.append(pText)
			if message.type == "error"
				div.addClass("alert-error")
			else
				div.addClass("alert-info")

			$('.messageArea').last().append(div)
	
			$(aClose).click (event) ->
				$(div).remove()

