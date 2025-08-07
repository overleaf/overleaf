import { ObjectId } from 'mongodb'
import { db } from '../app/js/mongodb.js'

const OPTS = parseArgs()

function parseArgs() {
  const args = process.argv.slice(2)
  if (args.length !== 3) {
    usage()
    process.exit(1)
  }
  const [roomId, userId, timestamp] = args
  return { roomId, userId, timestamp: new Date(timestamp) }
}

function usage() {
  console.error('Usage: resolve-comment.mjs ROOM_ID USER_ID TIMESTAMP')
}

async function resolveComment(roomId, userId, timestamp) {
  const result = await db.rooms.updateOne(
    { _id: new ObjectId(roomId) },
    {
      $set: {
        resolved: {
          user_id: userId, // this is a string in Mongo
          ts: timestamp,
        },
      },
    }
  )

  if (result.matchedCount === 0) {
    console.log(`Room not found: ${roomId}`)
  } else {
    console.log(`Comment resolved: room ${roomId}`)
  }
}

try {
  await resolveComment(OPTS.roomId, OPTS.userId, OPTS.timestamp)
} catch (err) {
  console.error(err)
  process.exit(1)
}
process.exit(0)
