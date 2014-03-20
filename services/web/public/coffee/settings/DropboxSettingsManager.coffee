define [
	"utils/Modal"
	"account/AccountManager"
	"underscore"
], (Modal, accountManager, _) ->
	_.templateSettings = interpolate : /\{\{(.+?)\}\}/g
	POLLING_INTERVAL = 15
	ONE_MIN_MILI = 1000*60
	USER_LINKED_TEMPLATE = _.template($('#userLinkedToDropboxTemplate').html())

	class DropboxSettingsManger
		constructor: (@ide)->

			setup = _.once =>
				@tab = $("#dropboxProjectSettings")
				tabLink = $('#manageDropboxSettiingsTabLink').on 'click', (event)=>
					@tab.empty()
					if !@ide.isAllowedToDoIt "owner"
					else if !@project.get('features').dropbox
						ga('send', 'event', 'subscription-funnel', 'askToUpgrade', {dropbox:true})
						accountManager.askToUpgrade @ide,
							onUpgrade: =>
								@checkIfUserIsLinkedToDropbox()
								ga('send', 'event', 'subscription-funnel', 'upgraded-free-trial', {dropbox:true})
					else
						@checkIfUserIsLinkedToDropbox()

			@ide.on "afterJoinProject", (project) =>
				@project = project
				setup()

		checkIfUserIsLinkedToDropbox : =>
				@ide.socket.emit "getUserDropboxLinkStatus", @project.get("owner").id, (err, status)=>
					if status.registered
						@buildLinkedView()
					else
						@buildNonLinkedView()
		
		buildLinkedView: ->
			self = @
			run = ->
				@ide.socket.emit "getLastTimePollHappned", (err, lastTimePollHappened)=>
					milisecondsSinceLastPoll = new Date().getTime() - lastTimePollHappened
					roundedMinsSinceLastPoll = Math.round(milisecondsSinceLastPoll / ONE_MIN_MILI)

					minsTillNextPoll = POLLING_INTERVAL - roundedMinsSinceLastPoll
					percentageLeftTillNextPoll = 100 - ((roundedMinsSinceLastPoll / POLLING_INTERVAL) * 100)

					html = $(USER_LINKED_TEMPLATE(minsTillNextPoll:minsTillNextPoll, percentageLeftTillNextPoll:percentageLeftTillNextPoll))
					self.tab.empty()
					self.tab.append html
					setTimeout run, ONE_MIN_MILI
			run()
		buildNonLinkedView: ->
			@tab.append $('#userNotLinkedToDropboxTemplate').html()
