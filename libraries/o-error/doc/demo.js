// This is the code from the README.

const OError = require('..')

const demoDatabase = {
  findUser(id, callback) {
    process.nextTick(() => {
      // return result asynchronously
      if (id === 42) {
        callback(null, { name: 'Bob' })
      } else {
        callback(new Error('not found'))
      }
    })
  },
}

function sayHi1(userId, callback) {
  demoDatabase.findUser(userId, (err, user) => {
    if (err) return callback(err)
    callback(null, 'Hi ' + user.name)
  })
}

sayHi1(42, (err, result) => {
  if (err) {
    console.error(err)
  } else {
    console.log(result)
  }
})

sayHi1(43, (err, result) => {
  if (err) {
    console.error(err)
  } else {
    console.log(result)
  }
})

function sayHi2(userId, callback) {
  demoDatabase.findUser(userId, (err, user) => {
    if (err) return callback(OError.tag(err))
    callback(null, 'Hi ' + user.name)
  })
}

sayHi2(43, (err, result) => {
  if (err) {
    console.error(OError.getFullStack(OError.tag(err)))
  } else {
    console.log(result)
  }
})

function sayHi3(userId, callback) {
  demoDatabase.findUser(userId, (err, user) => {
    if (err) return callback(OError.tag(err, 'failed to find user', { userId }))
    callback(null, 'Hi ' + user.name)
  })
}

sayHi3(43, (err, result) => {
  if (err) {
    OError.tag(err, 'failed to say hi')
    console.error(OError.getFullStack(err))
    console.error(OError.getFullInfo(err))
  } else {
    console.log(result)
  }
})

const promisify = require('node:util').promisify
demoDatabase.findUserAsync = promisify(demoDatabase.findUser)

async function sayHi4NoHandling(userId) {
  const user = await demoDatabase.findUserAsync(userId)
  return `Hi ${user.name}`
}

async function sayHi4(userId) {
  try {
    const user = await demoDatabase.findUserAsync(userId)
    return `Hi ${user.name}`
  } catch (error) {
    throw OError.tag(error, 'failed to find user', { userId })
  }
}

async function main() {
  try {
    await sayHi4NoHandling(43)
  } catch (error) {
    console.error(OError.getFullStack(error))
    console.error(OError.getFullInfo(error))
  }

  try {
    await sayHi4(43)
  } catch (error) {
    OError.tag(error, 'failed to say hi')
    console.error(OError.getFullStack(error))
    console.error(OError.getFullInfo(error))
  }
}
main()

class UserNotFoundError extends OError {
  constructor(userId) {
    super('user not found', { userId })
  }
}

try {
  throw new UserNotFoundError(123)
} catch (error) {
  console.error(OError.getFullStack(error))
  console.error(OError.getFullInfo(error))
}

async function sayHi5(userId) {
  try {
    const user = await demoDatabase.findUserAsync(userId)
    return `Hi ${user.name}`
  } catch (error) {
    if (error.message === 'not found') {
      throw new UserNotFoundError(userId).withCause(error)
    }
  }
}

async function main2() {
  try {
    await sayHi5(43)
  } catch (error) {
    OError.tag(error, 'failed to say hi')
    console.error(OError.getFullStack(error))
    console.error(OError.getFullInfo(error))
  }
}
main2()
