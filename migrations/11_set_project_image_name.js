const Settings = require('settings-sharelatex')
const mongojs = require('mongojs')
const db = mongojs(Settings.mongo.url, ['projects'])

exports.migrate = (client, done) => {
    console.log(`>> Setting 'imageName' in projects`)

    if (!Settings.currentImageName) {
        console.log(`>> 'currentImageName' is not defined, no projects updated`)
        return done()
    }

    console.log(`>> Setting 'imageName' = ${Settings.currentImageName}`)

    db.projects.update(
        { imageName: { $exists: false } },
        { $set: { imageName: Settings.currentImageName } },
        { multi: true },
        done
    )
}

exports.rollback = (client, done) => done()
