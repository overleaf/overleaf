'use strict'

const assert = require('check-types').assert

/**
 * @constructor
 * @param {number} id
 * @param {string} email
 * @param {string} name
 * @classdesc
 * An author of a {@link Change}. We want to store user IDs, and then fill in
 * the other properties (which the user can change over time) when changes are
 * loaded.
 *
 * At present, we're assuming that all authors have a user ID; we may need to
 * generalise this to cover users for whom we only have a name and email, e.g.
 * from git. For now, though, this seems to do what we need.
 */
function Author(id, email, name) {
  assert.number(id, 'bad id')
  assert.string(email, 'bad email')
  assert.string(name, 'bad name')

  this.id = id
  this.email = email
  this.name = name
}

/**
 * Create an Author from its raw form.
 *
 * @param {Object} [raw]
 * @return {Author | null}
 */
Author.fromRaw = function authorFromRaw(raw) {
  if (!raw) return null
  return new Author(raw.id, raw.email, raw.name)
}

/**
 * Convert the Author to raw form for storage or transmission.
 *
 * @return {Object}
 */
Author.prototype.toRaw = function authorToRaw() {
  return { id: this.id, email: this.email, name: this.name }
}

/**
 * @return {number}
 */
Author.prototype.getId = function () {
  return this.id
}

/**
 * @return {string}
 */
Author.prototype.getEmail = function () {
  return this.email
}

/**
 * @return {string}
 */
Author.prototype.getName = function () {
  return this.name
}

module.exports = Author
