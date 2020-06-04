const express = require('express')
const bodyParser = require('body-parser')
const app = express()

const projects = {}

const MessageHttpController = {
  getGlobalMessages: (req, res) => {
    res.send(projects[req.params.project_id] || [])
  },
  sendGlobalMessage: (req, res) => {
    const projectId = req.params.project_id
    const message = {
      id: Math.random().toString(),
      content: req.body.content,
      timestamp: Date.now(),
      user_id: req.body.user_id
    }
    projects[projectId] = projects[projectId] || []
    projects[projectId].push(message)
    res.sendStatus(201).send(Object.assign({ room_id: projectId }, message))
  }
}

const MockChatApi = {
  run() {
    app.use(bodyParser.json())

    app.get(
      '/project/:project_id/messages',
      MessageHttpController.getGlobalMessages
    )
    app.post(
      '/project/:project_id/messages',
      MessageHttpController.sendGlobalMessage
    )

    app
      .listen(3010, error => {
        if (error) {
          throw error
        }
      })
      .on('error', error => {
        console.error('error starting MockChatApi:', error.message)
        return process.exit(1)
      })
  }
}

MockChatApi.run()
