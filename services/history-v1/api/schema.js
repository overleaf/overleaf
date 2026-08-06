'use strict'

const { z, zz } = require('@overleaf/validation-tools')
const Blob = require('overleaf-editor-core').Blob
const {
  rawSnapshot,
  rawChange,
  rawBlobHash,
  rawFileMetadata,
} = require('overleaf-editor-core/lib/schemas')

const hexHashPattern = new RegExp(Blob.HEX_HASH_RX_STRING)

// Rollout-temporary fallback building blocks (main's pre-refinement shapes
// for imported snapshots/changes, before they were validated against
// overleaf-editor-core's raw* schemas); delete alongside the
// importSnapshotFallbackSchema/importChangesFallbackSchema opts below when
// this route's REQ_VALIDATION_MODE instrumentation is removed.
const fallbackFileSchema = z
  .object({
    hash: z.string().optional(),
    rangesHash: z.string().optional(),
    byteLength: z.number().int().nullable().optional(),
    stringLength: z.number().int().nullable().optional(),
    metadata: z.object({}).passthrough().optional(),
  })
  .passthrough()

const fallbackV2DocVersionsSchema = z.object({
  pathname: z.string().optional(),
  v: z.number().int().optional(),
})

const fallbackSnapshotSchema = z.object({
  files: z.record(z.string(), fallbackFileSchema),
  projectVersion: z.string().optional(),
  v2DocVersions: z
    .record(z.string(), fallbackV2DocVersionsSchema)
    .nullable()
    .optional(),
  timestamp: z.string().optional(),
})

const fallbackOperationSchema = z
  .object({
    pathname: z.string().optional(),
    newPathname: z.string().optional(),
    blob: z
      .object({
        hash: z.string(),
      })
      .optional(),
    textOperation: z.array(z.any()).optional(),
    file: fallbackFileSchema.optional(),
    contentHash: z.string().optional(),
  })
  .passthrough()

const fallbackOriginSchema = z
  .object({
    kind: z.string().optional(),
  })
  .passthrough()

const fallbackChangeSchema = z
  .object({
    timestamp: z.string(),
    operations: z.array(fallbackOperationSchema),
    authors: z.array(z.number().int().nullable()).optional(),
    v2Authors: z.array(z.string().nullable()).optional(),
    origin: fallbackOriginSchema.optional(),
    projectVersion: z.string().optional(),
    v2DocVersions: z.record(z.string(), fallbackV2DocVersionsSchema).optional(),
  })
  .passthrough()

const setContentBodyBase = z.object({
  pathname: z.string().min(1),
  source: z.string(),
  userId: zz.objectId().optional(),
  timestamp: zz.datetime(),
  metadata: rawFileMetadata.optional(),
  trackChanges: z.boolean().optional(),
})

const schemas = {
  projectId: z.object({
    params: z
      .object({
        project_id: zz.projectHistoryId().optional(),
      })
      .optional(),
  }),
  // Rollout-temporary fallback (pre-refinement schema from main); delete
  // when this route's REQ_VALIDATION_MODE instrumentation is removed.
  projectIdFallbackSchema: z.object({
    params: z
      .object({
        project_id: z.string().optional(),
      })
      .optional(),
  }),

  initializeProject: z.object({
    body: z
      .strictObject({
        projectId: zz.projectHistoryId().optional(),
      })
      .optional(),
  }),
  // Rollout-temporary fallback (pre-refinement schema from main); delete
  // when this route's REQ_VALIDATION_MODE instrumentation is removed.
  initializeProjectFallbackSchema: z.object({
    body: z
      .object({
        projectId: z.string().optional(),
      })
      .optional(),
  }),

  cloneProject: z.object({
    body: z.strictObject({
      targetProjectId: zz.projectHistoryId(),
    }),
    params: z.object({
      project_id: zz.projectHistoryId(),
    }),
  }),
  // Rollout-temporary fallback (pre-refinement schema from main); delete
  // when this route's REQ_VALIDATION_MODE instrumentation is removed.
  cloneProjectFallbackSchema: z.object({
    body: z.object({
      targetProjectId: z.string(),
    }),
    params: z.object({
      project_id: z.string(),
    }),
  }),

  getProjectBlobsStats: z.object({
    body: z.strictObject({
      projectIds: z.array(zz.projectHistoryId()),
    }),
  }),
  // Rollout-temporary fallback (pre-refinement schema from main); delete
  // when this route's REQ_VALIDATION_MODE instrumentation is removed.
  getProjectBlobsStatsFallbackSchema: z.object({
    body: z.object({
      projectIds: z.array(z.string()),
    }),
  }),

  getBlobStats: z.object({
    params: z.object({
      project_id: zz.projectHistoryId(),
    }),
    body: z.strictObject({
      blobHashes: z.array(rawBlobHash),
    }),
  }),
  // Rollout-temporary fallback (pre-refinement schema from main); delete
  // when this route's REQ_VALIDATION_MODE instrumentation is removed.
  getBlobStatsFallbackSchema: z.object({
    params: z.object({
      project_id: z.string(),
    }),
    body: z.object({
      blobHashes: z.array(z.string()),
    }),
  }),

  deleteProject: z.object({
    params: z.object({
      project_id: zz.projectHistoryId(),
    }),
  }),
  // Rollout-temporary fallback (pre-refinement schema from main); delete
  // when this route's REQ_VALIDATION_MODE instrumentation is removed.
  deleteProjectFallbackSchema: z.object({
    params: z.object({
      project_id: z.string(),
    }),
  }),

  getProjectBlob: z.object({
    params: z.object({
      project_id: zz.projectHistoryId(),
      hash: z.string().regex(hexHashPattern),
    }),
    headers: z.object({
      range: z.string().optional(),
    }),
  }),
  // Rollout-temporary fallback (pre-refinement schema from main); delete
  // when this route's REQ_VALIDATION_MODE instrumentation is removed.
  getProjectBlobFallbackSchema: z.object({
    params: z.object({
      project_id: z.string(),
      hash: z.string().regex(hexHashPattern),
    }),
    headers: z.object({
      range: z.string().optional(),
    }),
  }),

  headProjectBlob: z.object({
    params: z.object({
      project_id: zz.projectHistoryId(),
      hash: z.string().regex(hexHashPattern),
    }),
  }),
  // Rollout-temporary fallback (pre-refinement schema from main); delete
  // when this route's REQ_VALIDATION_MODE instrumentation is removed.
  headProjectBlobFallbackSchema: z.object({
    params: z.object({
      project_id: z.string(),
      hash: z.string().regex(hexHashPattern),
    }),
  }),

  createProjectBlob: z.object({
    params: z.object({
      project_id: zz.projectHistoryId(),
      hash: z.string().regex(hexHashPattern),
    }),
  }),
  // Rollout-temporary fallback (pre-refinement schema from main); delete
  // when this route's REQ_VALIDATION_MODE instrumentation is removed.
  createProjectBlobFallbackSchema: z.object({
    params: z.object({
      project_id: z.string(),
      hash: z.string().regex(hexHashPattern),
    }),
  }),

  copyProjectBlob: z.object({
    params: z.object({
      project_id: zz.projectHistoryId(),
      hash: z.string().regex(hexHashPattern),
    }),
    query: z.object({
      copyFrom: zz.projectHistoryId(),
      sizeLimit: z.coerce.number().optional(),
    }),
  }),
  // Rollout-temporary fallback (pre-refinement schema from main); delete
  // when this route's REQ_VALIDATION_MODE instrumentation is removed.
  copyProjectBlobFallbackSchema: z.object({
    params: z.object({
      project_id: z.string(),
      hash: z.string().regex(hexHashPattern),
    }),
    query: z.object({
      copyFrom: z.string(),
      sizeLimit: z.coerce.number().optional(),
    }),
  }),

  getLatestContent: z.object({
    params: z.object({
      project_id: zz.projectHistoryId(),
    }),
  }),
  // Rollout-temporary fallback (pre-refinement schema from main); delete
  // when this route's REQ_VALIDATION_MODE instrumentation is removed.
  getLatestContentFallbackSchema: z.object({
    params: z.object({
      project_id: z.string(),
    }),
  }),

  getLatestHashedContent: z.object({
    params: z.object({
      project_id: zz.projectHistoryId(),
    }),
  }),
  // Rollout-temporary fallback (pre-refinement schema from main); delete
  // when this route's REQ_VALIDATION_MODE instrumentation is removed.
  getLatestHashedContentFallbackSchema: z.object({
    params: z.object({
      project_id: z.string(),
    }),
  }),

  getLatestHistory: z.object({
    params: z.object({
      project_id: zz.projectHistoryId(),
    }),
  }),
  // Rollout-temporary fallback (pre-refinement schema from main); delete
  // when this route's REQ_VALIDATION_MODE instrumentation is removed.
  getLatestHistoryFallbackSchema: z.object({
    params: z.object({
      project_id: z.string(),
    }),
  }),

  getLatestHistoryRaw: z.object({
    params: z.object({
      project_id: zz.projectHistoryId(),
    }),
    query: z.object({
      readOnly: z.coerce.boolean().optional(),
    }),
  }),
  // Rollout-temporary fallback (pre-refinement schema from main); delete
  // when this route's REQ_VALIDATION_MODE instrumentation is removed.
  getLatestHistoryRawFallbackSchema: z.object({
    params: z.object({
      project_id: z.string(),
    }),
    query: z.object({
      readOnly: z.coerce.boolean().optional(),
    }),
  }),

  getLatestPersistedHistory: z.object({
    params: z.object({
      project_id: zz.projectHistoryId(),
    }),
  }),

  getHistory: z.object({
    params: z.object({
      project_id: zz.projectHistoryId(),
      version: z.coerce.number(),
    }),
  }),
  // Rollout-temporary fallback (pre-refinement schema from main); delete
  // when this route's REQ_VALIDATION_MODE instrumentation is removed.
  getHistoryFallbackSchema: z.object({
    params: z.object({
      project_id: z.string(),
      version: z.coerce.number(),
    }),
  }),

  getContentAtVersion: z.object({
    params: z.object({
      project_id: zz.projectHistoryId(),
      version: z.coerce.number(),
    }),
  }),
  // Rollout-temporary fallback (pre-refinement schema from main); delete
  // when this route's REQ_VALIDATION_MODE instrumentation is removed.
  getContentAtVersionFallbackSchema: z.object({
    params: z.object({
      project_id: z.string(),
      version: z.coerce.number(),
    }),
  }),

  getHistoryBefore: z.object({
    params: z.object({
      project_id: zz.projectHistoryId(),
      timestamp: zz.datetime(),
    }),
  }),
  // Rollout-temporary fallback (pre-refinement schema from main); delete
  // when this route's REQ_VALIDATION_MODE instrumentation is removed.
  getHistoryBeforeFallbackSchema: z.object({
    params: z.object({
      project_id: z.string(),
      timestamp: zz.datetime(),
    }),
  }),

  getLatestZip: z.object({
    params: z.object({
      project_id: zz.projectHistoryId(),
    }),
  }),
  // Rollout-temporary fallback (pre-refinement schema from main); delete
  // when this route's REQ_VALIDATION_MODE instrumentation is removed.
  getLatestZipFallbackSchema: z.object({
    params: z.object({
      project_id: z.string(),
    }),
  }),

  getZip: z.object({
    params: z.object({
      project_id: zz.projectHistoryId(),
      version: z.coerce.number(),
    }),
  }),
  // Rollout-temporary fallback (pre-refinement schema from main); delete
  // when this route's REQ_VALIDATION_MODE instrumentation is removed.
  getZipFallbackSchema: z.object({
    params: z.object({
      project_id: z.string(),
      version: z.coerce.number(),
    }),
  }),

  createZip: z.object({
    params: z.object({
      project_id: zz.projectHistoryId(),
      version: z.coerce.number(),
    }),
  }),
  // Rollout-temporary fallback (pre-refinement schema from main); delete
  // when this route's REQ_VALIDATION_MODE instrumentation is removed.
  createZipFallbackSchema: z.object({
    params: z.object({
      project_id: z.string(),
      version: z.coerce.number(),
    }),
  }),

  getChanges: z.object({
    params: z.object({
      project_id: zz.projectHistoryId(),
    }),
    query: z.object({
      since: z.coerce.number().optional(),
    }),
  }),
  // Rollout-temporary fallback (pre-refinement schema from main); delete
  // when this route's REQ_VALIDATION_MODE instrumentation is removed.
  getChangesFallbackSchema: z.object({
    params: z.object({
      project_id: z.string(),
    }),
    query: z.object({
      since: z.coerce.number().optional(),
    }),
  }),

  importSnapshot: z.object({
    params: z.object({
      project_id: zz.projectHistoryId(),
    }),
    body: rawSnapshot,
  }),
  // Rollout-temporary fallback (pre-refinement schema from main, before
  // imported snapshots were validated against overleaf-editor-core's
  // rawSnapshot); delete when this route's REQ_VALIDATION_MODE
  // instrumentation is removed.
  importSnapshotFallbackSchema: z.object({
    params: z.object({
      project_id: z.string(),
    }),
    body: fallbackSnapshotSchema,
  }),

  importChanges: z.object({
    params: z.object({
      project_id: zz.projectHistoryId(),
    }),
    query: z.object({
      end_version: z.coerce.number(),
      return_snapshot: z.enum(['hashed', 'none']).optional(),
    }),
    body: z.array(rawChange),
  }),
  // Rollout-temporary fallback (pre-refinement schema from main, before
  // imported changes were validated against overleaf-editor-core's
  // rawChange); delete when this route's REQ_VALIDATION_MODE
  // instrumentation is removed.
  importChangesFallbackSchema: z.object({
    params: z.object({
      project_id: z.string(),
    }),
    query: z.object({
      end_version: z.coerce.number(),
      return_snapshot: z.enum(['hashed', 'none']).optional(),
    }),
    body: z.array(fallbackChangeSchema),
  }),

  setContent: z.object({
    params: z.object({
      project_id: z.string(),
    }),
    // strict() rejects unknown keys, so a mixed payload with both content and
    // blobHash fails both union members and is rejected.
    body: z
      .union([
        setContentBodyBase.extend({ content: z.string() }).strict(),
        setContentBodyBase
          .extend({ blobHash: z.string().regex(hexHashPattern) })
          .strict(),
      ])
      .refine(
        body => {
          if (body.trackChanges && !body.userId) return false
          return true
        },
        {
          message: '"userId" is required when trackChanges is set',
          path: ['userId'],
        }
      ),
  }),

  flushChanges: z.object({
    params: z.object({
      project_id: zz.projectHistoryId(),
    }),
  }),
  // Rollout-temporary fallback (pre-refinement schema from main); delete
  // when this route's REQ_VALIDATION_MODE instrumentation is removed.
  flushChangesFallbackSchema: z.object({
    params: z.object({
      project_id: z.string(),
    }),
  }),

  expireProject: z.object({
    params: z.object({
      project_id: zz.projectHistoryId(),
    }),
  }),
  // Rollout-temporary fallback (pre-refinement schema from main); delete
  // when this route's REQ_VALIDATION_MODE instrumentation is removed.
  expireProjectFallbackSchema: z.object({
    params: z.object({
      project_id: z.string(),
    }),
  }),
}

module.exports = schemas
