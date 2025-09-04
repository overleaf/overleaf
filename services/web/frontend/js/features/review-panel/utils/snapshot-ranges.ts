import { TrackedDeletes } from '@/features/source-editor/utils/tracked-deletes'
import { UserId } from '../../../../../types/user'
import { ThreadId } from '../../../../../types/review-panel/review-panel'
import { Ranges } from '@/features/review-panel/context/ranges-context'
import { StringFileData } from 'overleaf-editor-core'
import { ProjectSnapshot } from '@/infrastructure/project-snapshot'

export const buildProjectRangesFromSnapshot = (
  projectSnapshot: ProjectSnapshot
) => {
  const projectRanges = new Map()
  for (const [path, file] of projectSnapshot.getDocs().entries()) {
    const ranges = buildRangesFromSnapshot(file.data as StringFileData, path)
    projectRanges.set(path, ranges)
  }
  return projectRanges
}

export const buildRangesFromSnapshot = (
  snapshot: StringFileData,
  docId: string
) => {
  const comments = snapshot.getComments()
  const trackedChanges = snapshot.getTrackedChanges()
  const snapshotContent = snapshot.getContent()

  const trackedDeletes = new TrackedDeletes(trackedChanges)

  const ranges: Ranges = {
    docId,
    changes: [], // TODO: trackedChanges, once React components are updated
    comments: [], // TODO: comments, once React components are updated
  }

  for (const trackedChange of trackedChanges) {
    const { range, tracking } = trackedChange
    const text = snapshotContent.substring(range.pos, range.end)
    const pos = trackedDeletes.toCodeMirror(range.pos)
    const id = `change-${tracking.type}-${pos}`

    const metadata = {
      user_id: tracking.userId as UserId,
      ts: tracking.ts,
    }

    const op =
      tracking.type === 'insert' ? { p: pos, i: text } : { p: pos, d: text }
    ranges.changes.push({ id, metadata, op, snapshotRange: range })
  }

  const seenComments = new Set<string>()
  for (const comment of comments) {
    if (!seenComments.has(comment.id)) {
      seenComments.add(comment.id)

      const range = comment.ranges[0] // show the comment next to the first range
      const pos = trackedDeletes.toCodeMirror(range.pos)
      const text = snapshotContent.substring(pos, range.end)

      ranges.comments.push({
        id: comment.id,
        op: {
          p: pos,
          c: text,
          t: comment.id as ThreadId,
        },
        snapshotRange: range,
        resolved: comment.resolved,
      })
    }
  }

  return ranges
}
