const ONE_MINUTE = 60 * 1000

const user = {
  id: 'fake_user',
  first_name: 'mortimer',
  email: 'fake@example.com',
}

const user2 = {
  id: 'another_fake_user',
  first_name: 'leopold',
  email: 'another_fake@example.com',
}

let nextMessageId = 1

export function generateMessages(count) {
  const messages = []
  let timestamp = new Date().getTime() // newest message goes first
  for (let i = 0; i <= count; i++) {
    const author = Math.random() > 0.5 ? user : user2
    // modify the timestamp so the previous message has 70% chances to be within 5 minutes from
    // the current one, for grouping purposes
    timestamp -= (4.3 + Math.random()) * ONE_MINUTE

    messages.push({
      id: '' + nextMessageId++,
      content: `message #${i}`,
      user: author,
      timestamp,
    })
  }
  return messages
}
