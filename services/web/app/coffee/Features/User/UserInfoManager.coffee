UserGetter = require "./UserGetter"

module.exports = UserInfoManager =
	getPersonalInfo: (user_id, callback = (error) ->) ->
		UserGetter.getUser user_id, { _id: true, first_name: true, last_name: true, email: true }, callback