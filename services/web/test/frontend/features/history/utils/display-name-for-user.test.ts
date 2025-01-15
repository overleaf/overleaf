import { expect } from 'chai'
import displayNameForUser from '@/features/history/utils/display-name-for-user'

describe('displayNameForUser', function () {
  const currentUsersId = 'user-a'
  beforeEach(function () {
    window.metaAttributesCache.set('ol-user', { id: currentUsersId })
  })

  it("should return 'Anonymous' with no user", function () {
    return expect(displayNameForUser(null)).to.equal('Anonymous')
  })

  it("should return 'you' when the user has the same id as the window", function () {
    return expect(
      displayNameForUser({
        id: currentUsersId,
        email: 'james.allen@overleaf.com',
        first_name: 'James',
        last_name: 'Allen',
      })
    ).to.equal('you')
  })

  it('should return the first_name and last_name when present', function () {
    return expect(
      displayNameForUser({
        id: currentUsersId + 1,
        email: 'james.allen@overleaf.com',
        first_name: 'James',
        last_name: 'Allen',
      })
    ).to.equal('James Allen')
  })

  it('should return only the first_name if no last_name', function () {
    return expect(
      displayNameForUser({
        id: currentUsersId + 1,
        email: 'james.allen@overleaf.com',
        first_name: 'James',
        last_name: '',
      })
    ).to.equal('James')
  })

  it('should return the email username if there are no names', function () {
    return expect(
      displayNameForUser({
        id: currentUsersId + 1,
        email: 'james.allen@overleaf.com',
        first_name: '',
        last_name: '',
      })
    ).to.equal('james.allen')
  })

  it("should return the '?' if it has nothing", function () {
    return expect(
      displayNameForUser({
        id: currentUsersId + 1,
        email: '',
        first_name: '',
        last_name: '',
      })
    ).to.equal('?')
  })
})
