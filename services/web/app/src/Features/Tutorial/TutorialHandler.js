const UserUpdater = require('../User/UserUpdater')

const POSTPONE_DURATION_MS = 24 * 60 * 60 * 1000 // 1 day

/**
 * Change the tutorial state
 *
 * @param {string} userId
 * @param {string} tutorialKey
 * @param {'completed' | 'postponed'} state
 * @param {Date} [postponedUntil] - The date until which the tutorial is postponed
 */
async function setTutorialState(
  userId,
  tutorialKey,
  state,
  postponedUntil = null
) {
  const updateData = {
    state,
    updatedAt: new Date(),
  }

  if (state === 'postponed' && postponedUntil) {
    updateData.postponedUntil = postponedUntil
  }

  await UserUpdater.promises.updateUser(userId, {
    $set: {
      [`completedTutorials.${tutorialKey}`]: updateData,
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
      const defaultPostponedUntil = new Date(
        record.updatedAt.getTime() + POSTPONE_DURATION_MS
      )

      const postponedUntil = record.postponedUntil ?? defaultPostponedUntil
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
