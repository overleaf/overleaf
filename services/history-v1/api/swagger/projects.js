'use strict'

const Blob = require('overleaf-editor-core').Blob

exports.paths = {
  '/projects': {
    post: {
      'x-swagger-router-controller': 'projects',
      operationId: 'initializeProject',
      tags: ['Project'],
      description: 'Initialize project.',
      consumes: ['application/json'],
      parameters: [
        {
          name: 'body',
          in: 'body',
          schema: {
            type: 'object',
            properties: {
              projectId: { type: 'string' },
            },
          },
        },
      ],
      responses: {
        200: {
          description: 'Initialized',
          schema: {
            $ref: '#/definitions/Project',
          },
        },
      },
      security: [
        {
          basic: [],
        },
      ],
    },
  },
  '/projects/{project_id}': {
    delete: {
      'x-swagger-router-controller': 'projects',
      operationId: 'deleteProject',
      tags: ['Project'],
      description: "Delete a project's history",
      parameters: [
        {
          name: 'project_id',
          in: 'path',
          description: 'project id',
          required: true,
          type: 'string',
        },
      ],
      responses: {
        204: {
          description: 'Success',
        },
      },
      security: [
        {
          basic: [],
        },
      ],
    },
  },
  '/projects/{project_id}/blobs/{hash}': {
    get: {
      'x-swagger-router-controller': 'projects',
      operationId: 'getProjectBlob',
      tags: ['Project'],
      description: 'Fetch blob content by its project id and hash.',
      parameters: [
        {
          name: 'project_id',
          in: 'path',
          description: 'project id',
          required: true,
          type: 'string',
        },
        {
          name: 'hash',
          in: 'path',
          description: 'Hexadecimal SHA-1 hash',
          required: true,
          type: 'string',
          pattern: Blob.HEX_HASH_RX_STRING,
        },
        {
          name: 'range',
          in: 'header',
          description: 'HTTP Range header',
          required: false,
          type: 'string',
        },
      ],
      produces: ['application/octet-stream'],
      responses: {
        200: {
          description: 'Success',
          schema: {
            type: 'file',
          },
        },
        404: {
          description: 'Not Found',
          schema: {
            $ref: '#/definitions/Error',
          },
        },
      },
      security: [{ jwt: [] }, { token: [] }],
    },
    head: {
      'x-swagger-router-controller': 'projects',
      operationId: 'headProjectBlob',
      tags: ['Project'],
      description: 'Fetch blob content-length by its project id and hash.',
      parameters: [
        {
          name: 'project_id',
          in: 'path',
          description: 'project id',
          required: true,
          type: 'string',
        },
        {
          name: 'hash',
          in: 'path',
          description: 'Hexadecimal SHA-1 hash',
          required: true,
          type: 'string',
          pattern: Blob.HEX_HASH_RX_STRING,
        },
      ],
      produces: ['application/octet-stream'],
      responses: {
        200: {
          description: 'Success',
          schema: {
            type: 'file',
          },
        },
        404: {
          description: 'Not Found',
          schema: {
            $ref: '#/definitions/Error',
          },
        },
      },
      security: [{ jwt: [] }, { token: [] }],
    },
    put: {
      'x-swagger-router-controller': 'projects',
      operationId: 'createProjectBlob',
      tags: ['Project'],
      description:
        'Create blob to be used in a file addition operation when importing a' +
        ' snapshot or changes',
      parameters: [
        {
          name: 'project_id',
          in: 'path',
          description: 'project id',
          required: true,
          type: 'string',
        },
        {
          name: 'hash',
          in: 'path',
          description: 'Hexadecimal SHA-1 hash',
          required: true,
          type: 'string',
          pattern: Blob.HEX_HASH_RX_STRING,
        },
      ],
      responses: {
        201: {
          description: 'Created',
        },
      },
    },
    post: {
      'x-swagger-router-controller': 'projects',
      operationId: 'copyProjectBlob',
      tags: ['Project'],
      description:
        'Copies a blob from a source project to a target project when duplicating a project',
      parameters: [
        {
          name: 'project_id',
          in: 'path',
          description: 'target project id',
          required: true,
          type: 'string',
        },
        {
          name: 'hash',
          in: 'path',
          description: 'Hexadecimal SHA-1 hash',
          required: true,
          type: 'string',
          pattern: Blob.HEX_HASH_RX_STRING,
        },
        {
          name: 'copyFrom',
          in: 'query',
          description: 'source project id',
          required: true,
          type: 'string',
        },
      ],
      responses: {
        201: {
          description: 'Created',
        },
      },
    },
  },
  '/projects/{project_id}/latest/content': {
    get: {
      'x-swagger-router-controller': 'projects',
      operationId: 'getLatestContent',
      tags: ['Project'],
      description:
        'Get full content of the latest version. Text file ' +
        'content is included, but binary files are just linked by hash.',
      parameters: [
        {
          name: 'project_id',
          in: 'path',
          description: 'project id',
          required: true,
          type: 'string',
        },
      ],
      responses: {
        200: {
          description: 'Success',
          schema: {
            $ref: '#/definitions/Snapshot',
          },
        },
        404: {
          description: 'Not Found',
          schema: {
            $ref: '#/definitions/Error',
          },
        },
      },
    },
  },
  '/projects/{project_id}/latest/hashed_content': {
    get: {
      'x-swagger-router-controller': 'projects',
      operationId: 'getLatestHashedContent',
      tags: ['Project'],
      description:
        'Get a snapshot of a project at the latest version ' +
        'with the hashes for the contents each file',
      parameters: [
        {
          name: 'project_id',
          in: 'path',
          description: 'project id',
          required: true,
          type: 'string',
        },
      ],
      responses: {
        200: {
          description: 'Success',
          schema: {
            $ref: '#/definitions/Snapshot',
          },
        },
        404: {
          description: 'Not Found',
          schema: {
            $ref: '#/definitions/Error',
          },
        },
      },
      security: [
        {
          basic: [],
        },
      ],
    },
  },
  '/projects/{project_id}/latest/history': {
    get: {
      'x-swagger-router-controller': 'projects',
      operationId: 'getLatestHistory',
      tags: ['Project'],
      description:
        'Get the latest sequence of changes.' +
        ' TODO probably want a configurable depth.',
      parameters: [
        {
          name: 'project_id',
          in: 'path',
          description: 'project id',
          required: true,
          type: 'string',
        },
      ],
      responses: {
        200: {
          description: 'Success',
          schema: {
            $ref: '#/definitions/ChunkResponse',
          },
        },
        404: {
          description: 'Not Found',
          schema: {
            $ref: '#/definitions/Error',
          },
        },
      },
    },
  },
  '/projects/{project_id}/latest/history/raw': {
    get: {
      'x-swagger-router-controller': 'projects',
      operationId: 'getLatestHistoryRaw',
      tags: ['Project'],
      description: 'Get the metadata of latest sequence of changes.',
      parameters: [
        {
          name: 'project_id',
          in: 'path',
          description: 'project id',
          required: true,
          type: 'string',
        },
        {
          name: 'readOnly',
          in: 'query',
          description: 'use read only database connection',
          required: false,
          type: 'boolean',
        },
      ],
      responses: {
        200: {
          description: 'Success',
          schema: {
            $ref: '#/definitions/ChunkResponseRaw',
          },
        },
        404: {
          description: 'Not Found',
          schema: {
            $ref: '#/definitions/Error',
          },
        },
      },
    },
  },
  '/projects/{project_id}/latest/persistedHistory': {
    get: {
      'x-swagger-router-controller': 'projects',
      operationId: 'getLatestPersistedHistory',
      tags: ['Project'],
      description: 'Get the latest sequence of changes.',
      parameters: [
        {
          name: 'project_id',
          in: 'path',
          description: 'project id',
          required: true,
          type: 'string',
        },
      ],
      responses: {
        200: {
          description: 'Success',
          schema: {
            $ref: '#/definitions/ChunkResponse',
          },
        },
        404: {
          description: 'Not Found',
          schema: {
            $ref: '#/definitions/Error',
          },
        },
      },
    },
  },

  '/projects/{project_id}/versions/{version}/history': {
    get: {
      'x-swagger-router-controller': 'projects',
      operationId: 'getHistory',
      tags: ['Project'],
      description:
        'Get the sequence of changes that includes the given version.',
      parameters: [
        {
          name: 'project_id',
          in: 'path',
          description: 'project id',
          required: true,
          type: 'string',
        },
        {
          name: 'version',
          in: 'path',
          description: 'numeric version',
          required: true,
          type: 'number',
        },
      ],
      responses: {
        200: {
          description: 'Success',
          schema: {
            $ref: '#/definitions/ChunkResponse',
          },
        },
        404: {
          description: 'Not Found',
          schema: {
            $ref: '#/definitions/Error',
          },
        },
      },
    },
  },
  '/projects/{project_id}/versions/{version}/content': {
    get: {
      'x-swagger-router-controller': 'projects',
      operationId: 'getContentAtVersion',
      tags: ['Project'],
      description: 'Get full content at the given version',
      parameters: [
        {
          name: 'project_id',
          in: 'path',
          description: 'project id',
          required: true,
          type: 'string',
        },
        {
          name: 'version',
          in: 'path',
          description: 'numeric version',
          required: true,
          type: 'number',
        },
      ],
      responses: {
        200: {
          description: 'Success',
          schema: {
            $ref: '#/definitions/Snapshot',
          },
        },
        404: {
          description: 'Not Found',
          schema: {
            $ref: '#/definitions/Error',
          },
        },
      },
    },
  },
  '/projects/{project_id}/timestamp/{timestamp}/history': {
    get: {
      'x-swagger-router-controller': 'projects',
      operationId: 'getHistoryBefore',
      tags: ['Project'],
      description:
        'Get the sequence of changes. ' + ' before the given timestamp',
      parameters: [
        {
          name: 'project_id',
          in: 'path',
          description: 'project id',
          required: true,
          type: 'string',
        },
        {
          name: 'timestamp',
          in: 'path',
          description: 'timestamp',
          required: true,
          type: 'string',
          format: 'date-time',
        },
      ],
      responses: {
        200: {
          description: 'Success',
          schema: {
            $ref: '#/definitions/ChunkResponse',
          },
        },
        404: {
          description: 'Not Found',
          schema: {
            $ref: '#/definitions/Error',
          },
        },
      },
    },
  },
  '/projects/{project_id}/version/{version}/zip': {
    get: {
      'x-swagger-router-controller': 'projects',
      operationId: 'getZip',
      tags: ['Project'],
      description: 'Download zip with project content',
      parameters: [
        {
          name: 'project_id',
          in: 'path',
          description: 'project id',
          required: true,
          type: 'string',
        },
        {
          name: 'version',
          in: 'path',
          description: 'numeric version',
          required: true,
          type: 'number',
        },
      ],
      produces: ['application/octet-stream'],
      responses: {
        200: {
          description: 'success',
        },
        404: {
          description: 'not found',
        },
      },
      security: [
        {
          token: [],
        },
      ],
    },
    post: {
      'x-swagger-router-controller': 'projects',
      operationId: 'createZip',
      tags: ['Project'],
      description:
        'Create a zip file with project content. Returns a link to be polled.',
      parameters: [
        {
          name: 'project_id',
          in: 'path',
          description: 'project id',
          required: true,
          type: 'string',
        },
        {
          name: 'version',
          in: 'path',
          description: 'numeric version',
          required: true,
          type: 'number',
        },
      ],
      responses: {
        200: {
          description: 'success',
          schema: {
            $ref: '#/definitions/ZipInfo',
          },
        },
        404: {
          description: 'not found',
        },
      },
      security: [
        {
          basic: [],
        },
      ],
    },
  },
}
