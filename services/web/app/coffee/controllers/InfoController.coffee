module.exports=
	themes : (req, res)=>
		res.render "info/themes",
			title: 'Themes'

	dropbox: (req, res)->
		res.render "info/dropbox",
			title: 'Dropbox with LaTeX'

	advisor: (req, res)->
		res.render "info/advisor",
			title: 'Advisor Program'