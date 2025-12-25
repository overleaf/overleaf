'use strict'

const { z, zz } = require('@overleaf/validation-tools')
const Blob = require('overleaf-editor-core').Blob

const hexHashPattern = new RegExp(Blob.HEX_HASH_RX_STRING)

const fileSchema = z.object({
  hash: z.string().optional(),
  byteLength: z.number().int().nullable().optional(),
  stringLength: z.number().int().nullable().optional(),
})

const snapshotSchema = z.object({
  files: z.record(z.string(), fileSchema),
})

const v2DocVersionsSchema = z.object({
  pathname: z.string().optional(),
  v: z.number().int().optional(),
})

const operationSchema = z
  .object({
    pathname: z.string().optional(),
    newPathname: z.string().optional(),
    blob: z
      .object({
        hash: z.string(),
      })
      .optional(),
    textOperation: z.array(z.any()).optional(),
    file: fileSchema.optional(),
    contentHash: z.string().optional(),
  })
  .passthrough()

const originSchema = z
  .object({
    kind: z.string().optional(),
  })
  .passthrough()

const changeSchema = z
  .object({
    timestamp: z.string(),
    operations: z.array(operationSchema),
    authors: z.array(z.number().int().nullable()).optional(),
    v2Authors: z.array(z.string().nullable()).optional(),
    origin: originSchema.optional(),
    projectVersion: z.string().optional(),
    v2DocVersions: z.record(z.string(), v2DocVersionsSchema).optional(),
  })
  .passthrough()

const schemas = {
  projectId: z.object({
    params: z
      .object({
        project_id: z.string().optional(),
      })
      .optional(),
  }),
  initializeProject: z.object({
    body: z
      .object({
        projectId: z.string().optional(),
      })
      .optional(),
  }),

  getProjectBlobsStats: z.object({
    body: z.object({
      projectIds: z.array(z.string()),
    }),
  }),

  getBlobStats: z.object({
    params: z.object({
      project_id: z.string(),
    }),
    body: z.object({
      blobHashes: z.array(z.string()),
    }),
  }),

  deleteProject: z.object({
    params: z.object({
      project_id: z.string(),
    }),
    body: z.any().optional(),
  }),

  getProjectBlob: z.object({
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
      project_id: z.string(),
      hash: z.string().regex(hexHashPattern),
    }),
  }),

  createProjectBlob: z.object({
    params: z.object({
      project_id: z.string(),
      hash: z.string().regex(hexHashPattern),
    }),
    body: z.any().optional(),
  }),

  copyProjectBlob: z.object({
    params: z.object({
      project_id: z.string(),
      hash: z.string().regex(hexHashPattern),
    }),
    query: z.object({
      copyFrom: z.string(),
    }),
    body: z.any().optional(),
  }),

  getLatestContent: z.object({
    params: z.object({
      project_id: z.string(),
    }),
  }),

  getLatestHashedContent: z.object({
    params: z.object({
      project_id: z.string(),
    }),
  }),

  getLatestHistory: z.object({
    params: z.object({
      project_id: z.string(),
    }),
  }),

  getLatestHistoryRaw: z.object({
    params: z.object({
      project_id: z.string(),
    }),
    query: z.object({
      readOnly: z.coerce.boolean().optional(),
    }),
  }),

  getLatestPersistedHistory: z.object({
    params: z.object({
      project_id: z.string(),
    }),
  }),

  getHistory: z.object({
    params: z.object({
      project_id: z.string(),
      version: z.coerce.number(),
    }),
  }),

  getContentAtVersion: z.object({
    params: z.object({
      project_id: z.string(),
      version: z.coerce.number(),
    }),
  }),

  getHistoryBefore: z.object({
    params: z.object({
      project_id: z.string(),
      timestamp: zz.datetime(),
    }),
  }),

  getZip: z.object({
    params: z.object({
      project_id: z.string(),
      version: z.coerce.number(),
    }),
  }),

  createZip: z.object({
    params: z.object({
      project_id: z.string(),
      version: z.coerce.number(),
    }),
    body: z.any().optional(),
  }),

  getChanges: z.object({
    params: z.object({
      project_id: z.string(),
    }),
    query: z.object({
      since: z.coerce.number().optional(),
    }),
  }),

  importSnapshot: z.object({
    params: z.object({
      project_id: z.string(),
    }),
    body: snapshotSchema,
  }),

  importChanges: z.object({
    params: z.object({
      project_id: z.string(),
    }),
    query: z.object({
      end_version: z.coerce.number(),
      return_snapshot: z.enum(['hashed', 'none']).optional(),
    }),
    body: z.array(changeSchema),
  }),

  flushChanges: z.object({
    params: z.object({
      project_id: z.string(),
    }),
    body: z.any().optional(),
  }),

  expireProject: z.object({
    params: z.object({
      project_id: z.string(),
    }),
    body: z.any().optional(),
  }),
}

module.exports = schemas
