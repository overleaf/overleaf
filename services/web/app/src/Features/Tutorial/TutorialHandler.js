const UserUpdater = require('../User/UserUpdater')

async function saveCompletion(userId, tutorialKey) {
  const completionDate = new Date()

  await UserUpdater.promises.updateUser(userId, {
    $set: {
      [`completedTutorials.${tutorialKey}`]: completionDate,
    },
  })
}

module.exports = { saveCompletion }
