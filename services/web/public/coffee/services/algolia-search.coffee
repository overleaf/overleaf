define [
	"base"
], (App) ->
	App.factory "algoliaSearch", ->
		if window.sharelatex?.algolia? and window.sharelatex.algolia?.indexes?.wiki?
			client = new AlgoliaSearch(window.sharelatex.algolia?.app_id, window.sharelatex.algolia?.api_key)
			wikiIdx = client.initIndex(window.sharelatex.algolia?.indexes?.wiki)
			kbIdx = client.initIndex(window.sharelatex.algolia?.indexes?.kb)

		service =
			searchWiki: wikiIdx.search.bind(wikiIdx)
			searchKB: kbIdx.search.bind(kbIdx)
		
		return service