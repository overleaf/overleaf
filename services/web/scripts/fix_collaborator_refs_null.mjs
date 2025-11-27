import minimist from 'minimist'
import {
  db,
  ObjectId,
  READ_PREFERENCE_SECONDARY,
} from '../app/src/infrastructure/mongodb.mjs'
import lodash from 'lodash'

const args = minimist(process.argv.slice(2), {
  boolean: ['commit'],
})

const run = async () => {
  try {
    const projects = await db.projectAuditLogEntries
      .find(
        {
          operation: 'collaborator-limit-exceeded',
          timestamp: {
            $gte: new Date('2025-03-26'),
            $lt: new Date('2025-04-02'),
          },
        },
        {
          readPreference: READ_PREFERENCE_SECONDARY,
          projection: {
            _id: 1,
            projectId: 1,
          },
        }
      )
      .toArray()

    const uniqueProjectIds = lodash.uniq(
      projects.map(p => p.projectId.toString())
    )

    console.log(
      `Found ${uniqueProjectIds.length} projects where collaborator-limit-exceeded operation was logged in provided date range`
    )

    let readOnlyCount = 0
    let pendingReviewerCount = 0
    let reviewerCount = 0

    for (const projectId of uniqueProjectIds) {
      if (args.commit) {
        const readOnlyUpdate = await db.projects.updateOne(
          {
            _id: new ObjectId(projectId),
            readOnly_refs: null,
          },
          {
            $set: {
              readOnly_refs: [],
            },
          }
        )
        if (readOnlyUpdate.modifiedCount > 0) {
          console.log(`Updated readOnly_refs for project id ${projectId}`)
        }
        readOnlyCount += readOnlyUpdate.modifiedCount
      } else {
        const project = await db.projects.findOne(
          {
            _id: new ObjectId(projectId),
            readOnly_refs: null,
          },
          {
            projection: {
              _id: 1,
              readOnly_refs: 1,
            },
          }
        )
        if (project) {
          readOnlyCount++
          console.log(
            `Dry run: Would update readOnly_refs for project id ${projectId}`
          )
        }
      }

      if (args.commit) {
        const pendingReviewerUpdate = await db.projects.updateOne(
          {
            _id: new ObjectId(projectId),
            pendingReviewer_refs: null,
          },
          {
            $set: {
              pendingReviewer_refs: [],
            },
          }
        )
        if (pendingReviewerUpdate.modifiedCount > 0) {
          console.log(
            `Updated pendingReviewer_refs for project id ${projectId}`
          )
        }
        pendingReviewerCount += pendingReviewerUpdate.modifiedCount
      } else {
        const project = await db.projects.findOne(
          {
            _id: new ObjectId(projectId),
            pendingReviewer_refs: null,
          },
          {
            projection: {
              _id: 1,
              pendingReviewer_refs: 1,
            },
          }
        )
        if (project) {
          pendingReviewerCount++
          console.log(
            `Dry run: Would update pendingReviewer_refs for project id ${projectId}`
          )
        }
      }

      if (args.commit) {
        const reviewerUpdate = await db.projects.updateOne(
          {
            _id: new ObjectId(projectId),
            reviewer_refs: null,
          },
          {
            $set: {
              reviewer_refs: [],
            },
          }
        )
        reviewerCount += reviewerUpdate.modifiedCount
      } else {
        const project = await db.projects.findOne(
          {
            _id: new ObjectId(projectId),
            reviewer_refs: null,
          },
          {
            projection: {
              _id: 1,
              reviewer_refs: 1,
            },
          }
        )
        if (project) {
          reviewerCount++
          console.log(
            `Dry run: Would update reviewer_refs for project id ${projectId}`
          )
        }
      }
    }

    if (args.commit) {
      console.log(
        `Updated readOnly_refs for ${readOnlyCount} projects, pendingReviewer_refs for ${pendingReviewerCount} projects, and reviewer_refs for ${reviewerCount} projects.`
      )
    } else {
      console.log(
        `Dry run: Would update readOnly_refs for ${readOnlyCount} projects, pendingReviewer_refs for ${pendingReviewerCount} projects, and reviewer_refs for ${reviewerCount} projects.`
      )
    }

    process.exit(0)
  } catch (err) {
    console.error('Error while processing projects:', err)
    process.exit(1)
  }
}

run()
