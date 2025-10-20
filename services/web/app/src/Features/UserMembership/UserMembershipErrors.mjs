import OError from '@overleaf/o-error'

class UserIsManagerError extends OError {}
class UserNotFoundError extends OError {}
class UserAlreadyAddedError extends OError {}

const UserMembershipErrors = {
  UserIsManagerError,
  UserNotFoundError,
  UserAlreadyAddedError,
}

export default UserMembershipErrors
