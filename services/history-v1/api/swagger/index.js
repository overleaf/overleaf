'use strict'

const _ = require('lodash')
const paths = _.reduce(
  [require('./projects').paths, require('./project_import').paths],
  _.extend
)

const securityDefinitions = require('./security_definitions')
module.exports = {
  swagger: '2.0',
  info: {
    title: 'Overleaf Editor API',
    description: 'API for the Overleaf editor.',
    version: '1.0',
  },
  produces: ['application/json'],
  basePath: '/api',
  paths,
  securityDefinitions,
  security: [
    {
      jwt: [],
    },
  ],
  definitions: {
    Project: {
      properties: {
        projectId: {
          type: 'string',
        },
      },
      required: ['projectId'],
    },
    File: {
      properties: {
        hash: {
          type: 'string',
        },
        byteLength: {
          type: 'integer',
        },
        stringLength: {
          type: 'integer',
        },
      },
    },
    Label: {
      properties: {
        authorId: {
          type: 'integer',
        },
        text: {
          type: 'string',
        },
        timestamp: {
          type: 'string',
        },
        version: {
          type: 'integer',
        },
      },
    },
    Chunk: {
      properties: {
        history: {
          $ref: '#/definitions/History',
        },
        startVersion: {
          type: 'number',
        },
      },
    },
    ChunkResponse: {
      properties: {
        chunk: {
          $ref: '#/definitions/Chunk',
        },
        authors: {
          type: 'array',
          items: {
            $ref: '#/definitions/Author',
          },
        },
      },
    },
    ChunkResponseRaw: {
      properties: {
        startVersion: {
          type: 'number',
        },
        endVersion: {
          type: 'number',
        },
        endTimestamp: {
          type: 'string',
        },
      },
    },
    History: {
      properties: {
        snapshot: {
          $ref: '#/definitions/Snapshot',
        },
        changes: {
          type: 'array',
          items: {
            $ref: '#/definitions/Change',
          },
        },
      },
    },
    Snapshot: {
      properties: {
        files: {
          type: 'object',
          additionalProperties: {
            $ref: '#/definitions/File',
          },
        },
      },
      required: ['files'],
    },
    Change: {
      properties: {
        timestamp: {
          type: 'string',
        },
        operations: {
          type: 'array',
          items: {
            $ref: '#/definitions/Operation',
          },
        },
        authors: {
          type: 'array',
          items: {
            type: ['integer', 'null'],
          },
        },
        v2Authors: {
          type: 'array',
          items: {
            type: ['string', 'null'],
          },
        },
        projectVersion: {
          type: 'string',
        },
        v2DocVersions: {
          type: 'object',
          additionalProperties: {
            $ref: '#/definitions/V2DocVersions',
          },
        },
      },
      required: ['timestamp', 'operations'],
    },
    V2DocVersions: {
      properties: {
        pathname: {
          type: 'string',
        },
        v: {
          type: 'integer',
        },
      },
    },
    ChangeRequest: {
      properties: {
        baseVersion: {
          type: 'integer',
        },
        untransformable: {
          type: 'boolean',
        },
        operations: {
          type: 'array',
          items: {
            $ref: '#/definitions/Operation',
          },
        },
        authors: {
          type: 'array',
          items: {
            type: ['integer', 'null'],
          },
        },
      },
      required: ['baseVersion', 'operations'],
    },
    ChangeNote: {
      properties: {
        baseVersion: {
          type: 'integer',
        },
        change: {
          $ref: '#/definitions/Change',
        },
      },
      required: ['baseVersion'],
    },
    Operation: {
      properties: {
        pathname: {
          type: 'string',
        },
        newPathname: {
          type: 'string',
        },
        blob: {
          $ref: '#/definitions/Blob',
        },
        textOperation: {
          type: 'array',
          items: {},
        },
        file: {
          $ref: '#/definitions/File',
        },
      },
    },
    Error: {
      properties: {
        message: {
          type: 'string',
        },
      },
      required: ['message'],
    },
    Blob: {
      properties: {
        hash: {
          type: 'string',
        },
      },
      required: ['hash'],
    },
    Author: {
      properties: {
        id: {
          type: 'integer',
        },
        email: {
          type: 'string',
        },
        name: {
          type: 'string',
        },
      },
      required: ['id', 'email', 'name'],
    },
    SyncState: {
      properties: {
        synced: {
          type: 'boolean',
        },
      },
    },
    ZipInfo: {
      properties: {
        zipUrl: {
          type: 'string',
        },
      },
      required: ['zipUrl'],
    },
  },
}
