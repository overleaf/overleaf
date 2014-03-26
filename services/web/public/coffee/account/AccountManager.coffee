define [
	"utils/Modal"
], (Modal) ->



	AccountManager =
		askToUpgrade: (ide, options = {}) ->
			options.why ||= "to use this feature"
			if ide.project.get("owner") == ide.user
				if ide.user.get("subscription").freeTrial.allowed
					@showCreditCardFreeTrialModal(options)
				else
					@showUpgradeDialog(ide, options)
			else
				@showAskOwnerDialog(ide, options)

		showCreditCardFreeTrialModal: (options) ->
			Modal.createModal
				title: "Start your free trial"
				message: "You need to upgrade your account #{options.why}. Would you like to start a 30 day free trial? You can cancel at any point."
				buttons: [{
					text: "Cancel"
					class: ""
				},{
					text: "Enter Billing Information"
					class: "btn-primary"
					callback: () =>
						options.onUpgrade?()
						@gotoSubscriptionsPage()
				}]

		gotoSubscriptionsPage: () ->
			window.open("/user/subscription/new?planCode=student_free_trial")
			Modal.createModal
				title: "Please refresh"
				message: "Please refresh this page after starting your free trial. This will make sure all of your features are enabled."
				buttons: [{
					text: "OK"
					class: ""
				}]

		showUpgradeDialog: (ide, options = {}) ->
			options.message ||= """
				Sorry, you need to upgrade your account #{options.why}.
				You can do this on your account settings page,
				accessible in the top right hand corner.
			"""
			Modal.createModal
				title: "Please upgrade your account"
				message: options.message
				buttons: [{
					text: "OK"
					class: "btn"
					callback: () ->	options.onCancel() if options.onCancel
				},{
					text: "See Plans"
					class: "btn-success"
					callback: () -> window.open("/user/subscription/plans")
				}]
		
		showAskOwnerDialog: (ide, options = {}) ->
			Modal.createModal
				title: "Owner needs an upgraded account"
				message: "Please ask the owner of this project to upgrade their account #{options.why}."
				buttons: [{
					text: "OK"
					class: "btn-primary"
					callback: () ->	options.onCancel() if options.onCancel
				}]
