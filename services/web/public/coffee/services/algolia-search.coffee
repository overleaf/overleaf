define [
	"base"
], (App) ->
	App.factory "algoliaSearch", ->
		if window.sharelatex?.algolia? and window.sharelatex.algolia?.indexes?.wiki?
			client = new AlgoliaSearch(window.sharelatex.algolia?.app_id, window.sharelatex.algolia?.api_key)
			wikiIdx = client.initIndex(window.sharelatex.algolia?.indexes?.wiki)
			kbIdx = client.initIndex(window.sharelatex.algolia?.indexes?.kb)

		service =
			searchWiki: if wikiIdx then wikiIdx.search.bind(wikiIdx) else null
			searchKB: if kbIdx then kbIdx.search.bind(kbIdx) else null
		
		return service