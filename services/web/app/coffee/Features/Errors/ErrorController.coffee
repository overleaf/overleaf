module.exports = ErrorController =
	notFound: (req, res)->
		res.statusCode = 404
		res.render 'general/404',
			title: "page_not_found"