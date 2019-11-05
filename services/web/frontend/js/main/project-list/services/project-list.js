/* eslint-disable
    camelcase
*/
define(['base'], App =>
  App.service('ProjectListService', () => ({
    getOwnerName(project) {
      if (project.accessLevel === 'owner') {
        return 'You'
      } else if (project.owner != null) {
        return this.getUserName(project.owner)
      } else {
        return 'None'
      }
    },

    getUserName(user) {
      if (user && user._id === window.user_id) {
        return 'You'
      } else if (user) {
        const { first_name, last_name, email } = user
        if (first_name || last_name) {
          return [first_name, last_name].filter(n => n != null).join(' ')
        } else if (email) {
          return email
        } else {
          return 'An Overleaf v1 User'
        }
      } else {
        return 'None'
      }
    }
  })))
