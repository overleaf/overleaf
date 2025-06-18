'use strict'

const importSnapshot = {
  'x-swagger-router-controller': 'project_import',
  operationId: 'importSnapshot',
  tags: ['ProjectImport'],
  description: 'Import a snapshot from the current rails app.',
  consumes: ['application/json'],
  parameters: [
    {
      name: 'project_id',
      in: 'path',
      description: 'project id',
      required: true,
      type: 'string',
    },
    {
      name: 'snapshot',
      in: 'body',
      description: 'Snapshot to import.',
      required: true,
      schema: {
        $ref: '#/definitions/Snapshot',
      },
    },
  ],
  responses: {
    200: {
      description: 'Imported',
    },
    409: {
      description: 'Conflict: project already initialized',
    },
    404: {
      description: 'No such project exists',
    },
  },
  security: [
    {
      basic: [],
    },
  ],
}

const importChanges = {
  'x-swagger-router-controller': 'project_import',
  operationId: 'importChanges',
  tags: ['ProjectImport'],
  description: 'Import changes for a project from the current rails app.',
  consumes: ['application/json'],
  parameters: [
    {
      name: 'project_id',
      in: 'path',
      description: 'project id',
      required: true,
      type: 'string',
    },
    {
      name: 'end_version',
      description: 'end_version of latest persisted chunk',
      in: 'query',
      required: true,
      type: 'number',
    },
    {
      name: 'return_snapshot',
      description:
        'optionally, return a snapshot with the latest hashed content',
      in: 'query',
      required: false,
      type: 'string',
      enum: ['hashed', 'none'],
    },
    {
      name: 'changes',
      in: 'body',
      description: 'changes to be imported',
      required: true,
      schema: {
        type: 'array',
        items: {
          $ref: '#/definitions/Change',
        },
      },
    },
  ],
  responses: {
    201: {
      description: 'Created',
      schema: {
        $ref: '#/definitions/Snapshot',
      },
    },
  },
  security: [
    {
      basic: [],
    },
  ],
}

const getChanges = {
  'x-swagger-router-controller': 'projects',
  operationId: 'getChanges',
  tags: ['Project'],
  description: 'Get changes applied to a project',
  parameters: [
    {
      name: 'project_id',
      in: 'path',
      description: 'project id',
      required: true,
      type: 'string',
    },
    {
      name: 'since',
      in: 'query',
      description: 'start version',
      required: false,
      type: 'number',
    },
  ],
  responses: {
    200: {
      description: 'Success',
      schema: {
        type: 'array',
        items: {
          $ref: '#/definitions/Change',
        },
      },
    },
  },
  security: [
    {
      basic: [],
    },
  ],
}

const flushChanges = {
  'x-swagger-router-controller': 'project_import',
  operationId: 'flushChanges',
  tags: ['ProjectImport'],
  description: 'Flush project changes from buffer to the chunk store.',
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
        $ref: '#/definitions/Project',
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
}

const expireProject = {
  'x-swagger-router-controller': 'project_import',
  operationId: 'expireProject',
  tags: ['ProjectImport'],
  description: 'Expire project changes from buffer.',
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
        $ref: '#/definitions/Project',
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
}

exports.paths = {
  '/projects/{project_id}/import': { post: importSnapshot },
  '/projects/{project_id}/legacy_import': { post: importSnapshot },
  '/projects/{project_id}/changes': { get: getChanges, post: importChanges },
  '/projects/{project_id}/legacy_changes': { post: importChanges },
  '/projects/{project_id}/flush': { post: flushChanges },
  '/projects/{project_id}/expire': { post: expireProject },
}
