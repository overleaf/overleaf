define [
	"libs/mustache"
], () ->
	class TabManager
		templates:
			tab: $("#tabTemplate").html()
			content: $("#tabContentTemplate").html()

		constructor: () ->
			@locked_open = false
			@locked_closed = false
			@state = "closed"
			$("#toolbar").on "mouseenter", () => @onMouseOver()
			$("#toolbar").on "mouseleave", (e) => @onMouseOut(e)
			@tabs = []

		addTab: (options) ->
			@tabs.push options

			tabEl = $(Mustache.to_html @templates.tab, options)
			tabEl.find("a").attr("href", "#" + options.id)

			if options.content?
				contentEl = $(Mustache.to_html @templates.content, options)
				contentEl.append(options.content)
				$("#tab-content").append(contentEl)

			if options.active
				tabEl.addClass("active")
				contentEl?.addClass("active")

			if options.after?
				tabEl.insertAfter($("##{options.after}-tab-li"))
			else
				$("#tabs").append(tabEl)

			$("body").scrollTop(0)
			tabEl.on "shown", () =>
				$("body").scrollTop(0)

				options.onShown() if options.onShown?
				for other_tab in @tabs
					if other_tab.id != options.id and other_tab.active and other_tab.onHidden?
						other_tab.onHidden()
					other_tab.active = false
				options.active = true

				if options.lock
					@lockOpen()
				else
					@unlockOpen()

				if options.contract
					@contract()


		lockOpen: () ->
			@locked_open = true
			$("#toolbar").css({
				width: 180
			})

		unlockOpen: () ->
			@locked_open = false

		contract: () ->
			$("#toolbar").css({
				width: 40
			})
			# cooldown so we don't immediately reopen
			original_locked_closed = @locked_closed
			@locked_closed = true
			setTimeout () =>
				@locked_closed = original_locked_closed
			, 200
			
		onMouseOver: () ->
			if !@locked_closed and @state == "closed"
				@openMenu()

		onMouseOut: (e) ->
			@cancelOpen()
			if !@locked_open and @state == "open"
				@closeMenu()

		cancelOpen: () ->
			if @openTimeout
				clearTimeout @openTimeout
				@state = "closed"

		openMenu: () ->
			@openTimeout = setTimeout () =>
				@state = "open"
				$("#toolbar").animate({
					width: 180
				}, "fast")
				delete @openTimeout
			, 500

		closeMenu: () ->
			@state = "closed"
			$("#toolbar").animate({
				width: 40
			}, "fast")
			
			
