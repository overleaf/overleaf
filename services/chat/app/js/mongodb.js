const Settings = require('@overleaf/settings')
const { MongoClient, ObjectId } = require('mongodb')

const client = new MongoClient(Settings.mongo.url)
const db = client.db()

const collections = {
  messages: db.collection('messages'),
  rooms: db.collection('rooms'),
}

module.exports = {
  db: collections,
  mongoClient: client,
  ObjectId,
}
