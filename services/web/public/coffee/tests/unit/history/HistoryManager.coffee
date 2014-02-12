define [
	"libs/chai"
	"history/HistoryManager"
	"models/Project"
	"account/AccountManager"
	"libs/sinon"
], (chai, HistoryManager, Project, AccountManager) ->
	should = chai.should()

	describe "HistoryManager", ->
		beforeEach ->
			@editor =
				sideBarView:
					addLink: sinon.stub()
					selectLink: (identifier) ->
				mainAreaManager:
					change: (selector) ->
					addArea: (options) ->
						$("#test-area").append(options.element)
						options.element.show()
			_.extend(@editor, Backbone.Events)
			@historyManager = new HistoryManager @editor
			sinon.stub @historyManager.versionListView, "loadUntilFull", () ->
			sinon.stub @historyManager.versionList, "fetchNewVersions", () ->

		afterEach -> @historyManager.historyPanel.remove()

		describe "takeSnapshot", ->
			beforeEach ->
				@error = false
				sinon.stub $, "ajax", (options) =>
					if @error
						options.error() if options.error?
					else
						options.success() if options.success?
				@project = new Project id: userSettings.project_id
				@message = "what a wonderful message"
				@editor.trigger("afterJoinProject", @project)

			afterEach ->
				$.ajax.restore()

			describe "success", ->
				beforeEach ->
					@error = false
					@callback = sinon.stub()
					@historyManager.takeSnapshot(@message, @callback)

				it "should POST to /project/<project_id>/snapshot", ->
					$.ajax.called.should.equal true
					options = $.ajax.args[0][0]
					options.type.should.equal "POST"
					options.url.should.equal "/project/#{userSettings.project_id}/snapshot"
					options.data.should.deep.equal message: @message

				it "should call the callback without an error", ->
					@callback.called.should.equal true
					@callback.args[0].length.should.equal 0

				it "should call fetchNewVersions on collection", ->
					@historyManager.versionList.fetchNewVersions
						.called.should.equal true

			describe "error", ->
				beforeEach ->
					@error = true
					@callback = sinon.stub()
					@historyManager.takeSnapshot(@message, @callback)

				it "should call the callback with an error", ->
					@callback.called.should.equal true
					(@callback.args[0][0] instanceof Error).should.equal true

		describe "with versioning to be shown", ->
			beforeEach ->
				@project = new Project
					features : {}
				@editor.project = @project
				@editor.trigger("afterJoinProject", @project)

			it "should insert the History link into the side bar", ->
				@editor.sideBarView.addLink.called.should.equal true
				args = @editor.sideBarView.addLink.args[0][0]
				args.identifier.should.equal "history"
				args.before.should.equal "settings"
				should.exist args.element
				args.element.text().should.equal "History"

			describe "when clicking on the history link", ->
				beforeEach ->
					@element = @editor.sideBarView.addLink.args[0][0].element

				describe "generally", ->
					beforeEach ->
						sinon.spy @historyManager, "showHistoryArea"
						sinon.spy @editor.sideBarView, "selectLink"
						sinon.spy @editor.mainAreaManager, "change"
						@element.click()

					it "should call showHistoryArea", ->
						@historyManager.showHistoryArea.called.should.equal true

					it "should select the history link", ->
						@editor.sideBarView.selectLink.called.should.equal true
						@editor.sideBarView.selectLink.calledWith("history").should.equal true

					it "should show the history area", ->
						@editor.mainAreaManager.change.called.should.equal true
						@editor.mainAreaManager.change.calledWith("history").should.equal true

				describe "with versioning enabled", ->
					beforeEach ->
						@project.get("features").versioning = true
						@element.click()

					it "should display the history", ->
						@historyManager.view.$("#versionListArea").is(":visible").should.equal true
						@historyManager.view.$("#diffViewArea").is(":visible").should.equal true
						@historyManager.view.$("#enableVersioningMessage").is(":visible").should.equal false

					it "should load versions when the history area is shown", ->
						@historyManager.showHistoryArea()
						@historyManager.versionListView.loadUntilFull.called.should.equal true
						@historyManager.versionList.fetchNewVersions.called.should.equal true

				describe "with versioning disabled", ->
					beforeEach ->
						@project.get("features").versioning = false
						@element.click()

					it "should display the prompt to enable versioning", ->
						@historyManager.view.$("#versionListArea").is(":visible").should.equal false
						@historyManager.view.$("#diffViewArea").is(":visible").should.equal false
						@historyManager.view.$("#enableVersioningMessage").is(":visible").should.equal true

					it "should not attempt to load versions when the history area is shown", ->
						@historyManager.showHistoryArea()
						@historyManager.versionListView.loadUntilFull.called.should.equal false
						@historyManager.versionList.fetchNewVersions.called.should.equal false

					describe "when the user clicks 'Enable now'", ->
						describe "when enabled succesfully", ->
							beforeEach ->
								sinon.stub AccountManager, "askToUpgrade", (editor, options) ->
									editor.project.set("features", versioning: true)
									options.onUpgrade()
								@historyManager.view.$("#enableVersioning").click()

							afterEach ->
								AccountManager.askToUpgrade.restore()

							it "should start the user on their free trial", ->
								AccountManager.askToUpgrade.called.should.equal true

							it "should display the history interface", ->
								@historyManager.view.$("#versionListArea").is(":visible").should.equal true
								@historyManager.view.$("#diffViewArea").is(":visible").should.equal true
								@historyManager.view.$("#enableVersioningMessage").is(":visible").should.equal false
