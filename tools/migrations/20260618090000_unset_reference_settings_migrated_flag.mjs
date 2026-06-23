import { db } from './lib/mongodb.mjs'
import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'

// Cleanup following the removal of the reference manager settings migration
// code (see #34507). The `migrated` flag was written alongside the
// zotero/mendeley/papers settings during the local-storage -> mongo migration
// and is no longer read or written, so we $unset it from existing user
// documents.

// Non-blocking: the field is already unused in code, so this cleanup does not
// need to be applied before the deploy that ships it.
const tags = ['saas', 'server-ce', 'server-pro', 'nonblocking']

const MIGRATED_FIELDS = [
  'ace.zotero.migrated',
  'ace.mendeley.migrated',
  'ace.papers.migrated',
]

const migrate = async () => {
  await batchedUpdate(
    db.users,
    { $or: MIGRATED_FIELDS.map(field => ({ [field]: { $exists: true } })) },
    { $unset: Object.fromEntries(MIGRATED_FIELDS.map(field => [field, ''])) }
  )
}

// No rollback: the original per-user value of `migrated` is not recoverable and
// the field is no longer used anywhere.
const rollback = async () => {}

export default {
  tags,
  migrate,
  rollback,
}
