function getAnalyticsIdFromMongoUser(user) {
  // ensure `analyticsId` is set to the user's `analyticsId`, and fallback to their `userId` for pre-analyticsId users
  return user.analyticsId || user._id
}

module.exports = {
  getAnalyticsIdFromMongoUser,
}
