import { expect } from 'chai'
import { isValidEmail } from '../../../../frontend/js/shared/utils/email'

const validEmailAddresses = [
  'email@example.com',
  'firstname.lastname@example.com',
  'firstname-lastname@example.com',
  'email@subdomain.example.com',
  'firstname+lastname@example.com',
  '1234567890@example.com',
  'email@example-one.com',
  '_@example.com',
  'email@example.name',
  'email@example.co.jp',
]

const invalidEmailAddresses = [
  'plaintext',
  '#@%^%#$@#$@#.com',
  '@example.com',
  'email.example.com',
  '.email@example.com',
  'email.@example.com',
  'email..email@example.com',
  'email@example.com (Joe Smith)',
  'email@example',
  'email@111.222.333.44444',
  'email@example..com',
]

describe('isValidEmail', function () {
  it('should return true for valid email addresses', function () {
    validEmailAddresses.forEach(email =>
      expect(isValidEmail(email)).to.equal(true, email + ' should be valid ')
    )
  })

  it('should return false for invalid email addresses', function () {
    invalidEmailAddresses.forEach(email =>
      expect(isValidEmail(email)).to.equal(
        false,
        email + ' should not be valid '
      )
    )
  })
})
