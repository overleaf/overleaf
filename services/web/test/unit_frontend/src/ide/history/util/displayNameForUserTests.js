/* eslint-disable
    no-return-assign,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['ide/history/util/displayNameForUser'], displayNameForUser =>
  describe('displayNameForUser', function() {
    beforeEach(function() {
      return (window.user = { id: 42 })
    })

    it("should return 'Anonymous' with no user", function() {
      return expect(displayNameForUser(null)).to.equal('Anonymous')
    })

    it("should return 'you' when the user has the same id as the window", function() {
      return expect(
        displayNameForUser({
          id: window.user.id,
          email: 'james.allen@overleaf.com',
          first_name: 'James',
          last_name: 'Allen'
        })
      ).to.equal('you')
    })

    it('should return the first_name and last_name when present', function() {
      return expect(
        displayNameForUser({
          id: window.user.id + 1,
          email: 'james.allen@overleaf.com',
          first_name: 'James',
          last_name: 'Allen'
        })
      ).to.equal('James Allen')
    })

    it('should return only the firstAname if no last_name', function() {
      return expect(
        displayNameForUser({
          id: window.user.id + 1,
          email: 'james.allen@overleaf.com',
          first_name: 'James',
          last_name: ''
        })
      ).to.equal('James')
    })

    it('should return the email username if there are no names', function() {
      return expect(
        displayNameForUser({
          id: window.user.id + 1,
          email: 'james.allen@overleaf.com',
          first_name: '',
          last_name: ''
        })
      ).to.equal('james.allen')
    })

    it("should return the '?' if it has nothing", function() {
      return expect(
        displayNameForUser({
          id: window.user.id + 1,
          email: '',
          first_name: '',
          last_name: ''
        })
      ).to.equal('?')
    })
  }))
