module.exports = 

	use: (req, res, next)->
		if req.query?
			if req.query.referal?
				req.session.referal_id = req.query.referal
			else if req.query.r? # Short hand for referal
				req.session.referal_id = req.query.r
			else if req.query.fb_ref?
				req.session.referal_id = req.query.fb_ref

			if req.query.rm? # referal medium e.g. twitter, facebook, email
				switch req.query.rm
					when "fb"
						req.session.referal_medium = "facebook"
					when "t"
						req.session.referal_medium = "twitter"
					when "gp"
						req.session.referal_medium = "google_plus"
					when "e"
						req.session.referal_medium = "email"
					when "d"
						req.session.referal_medium = "direct"

			if req.query.rs? # referal source e.g. project share, bonus
				switch req.query.rs
					when "b"
						req.session.referal_source = "bonus"
					when "ps"
						req.session.referal_source = "public_share"
					when "ci"
						req.session.referal_source = "collaborator_invite"

		next()
