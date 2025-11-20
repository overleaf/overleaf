import UserGetter from '../User/UserGetter.mjs'
import Mongo from '../Helpers/Mongo.mjs'

const { isObjectIdInstance } = Mongo

const UserMembershipViewModel = {
  build(userOrEmail) {
    if (userOrEmail._id) {
      return buildUserViewModel(userOrEmail, false)
    } else {
      return buildUserViewModelWithEmail(userOrEmail)
    }
  },

  async buildAsync(userOrIdOrEmailArray) {
    const userObjectIds = userOrIdOrEmailArray.filter(isObjectIdInstance)
    const results = []
    try {
      const users = await UserGetter.promises.getUsers(userObjectIds, {
        email: 1,
        first_name: 1,
        last_name: 1,
        lastLoggedIn: 1,
        lastActive: 1,
        enrollment: 1,
      })
      const usersMap = new Map()
      for (const user of users) {
        usersMap.set(user._id.toString(), user)
      }

      userOrIdOrEmailArray.forEach(item => {
        if (isObjectIdInstance(item)) {
          const user = usersMap.get(item.toString())
          if (!user) {
            results.push(buildUserViewModelWithId(item.toString()))
          } else {
            results.push(buildUserViewModel(user, false))
          }
        } else {
          // `item` is a user or an email and can be parsed by #build
          results.push(UserMembershipViewModel.build(item))
        }
      })
    } catch (error) {
      userOrIdOrEmailArray.forEach(item => {
        if (isObjectIdInstance(item)) {
          results.push(buildUserViewModelWithId(item.toString()))
        } else {
          // `item` is a user or an email and can be parsed by #build
          results.push(UserMembershipViewModel.build(item))
        }
      })
    }
    return results
  },
}

function buildUserViewModel(user, isInvite) {
  return {
    _id: user._id || null,
    email: user.email || null,
    first_name: user.first_name || null,
    last_name: user.last_name || null,
    last_active_at: user.lastActive || user.lastLoggedIn || null,
    last_logged_in_at: user.lastLoggedIn || null,
    invite: isInvite,
    enrollment: user.enrollment
      ? {
          managedBy: user.enrollment.managedBy,
          enrolledAt: user.enrollment.enrolledAt,
          sso: user.enrollment.sso,
        }
      : undefined,
  }
}

const buildUserViewModelWithEmail = email => buildUserViewModel({ email }, true)

const buildUserViewModelWithId = id => buildUserViewModel({ _id: id }, false)

UserMembershipViewModel.promises = {
  buildAsync: UserMembershipViewModel.buildAsync,
}

export default UserMembershipViewModel
