const UserUpdater = require('../User/UserUpdater')

const POSTPONE_DURATION_MS = 24 * 60 * 60 * 1000 // 1 day

/**
 * Change the tutorial state
 *
 * @param {string} userId
 * @param {string} tutorialKey
 * @param {'completed' | 'postponed'} state
 */
async function setTutorialState(userId, tutorialKey, state) {
  await UserUpdater.promises.updateUser(userId, {
    $set: {
      [`completedTutorials.${tutorialKey}`]: { state, updatedAt: new Date() },
    },
  })
}

/**
 * Returns a list of inactive tutorials for a given user
 *
 * The user must be loaded with the completedTutorials property.
 */
function getInactiveTutorials(user, tutorialKey) {
  const inactiveTutorials = []
  for (const [key, record] of Object.entries(user.completedTutorials ?? {})) {
    if (record instanceof Date) {
      // Legacy format: single date means the tutorial was completed
      inactiveTutorials.push(key)
    } else if (record.state === 'postponed') {
      const postponedUntil = new Date(
        record.updatedAt.getTime() + POSTPONE_DURATION_MS
      )
      if (new Date() < postponedUntil) {
        inactiveTutorials.push(key)
      }
    } else {
      inactiveTutorials.push(key)
    }
  }
  return inactiveTutorials
}

module.exports = { setTutorialState, getInactiveTutorials }
