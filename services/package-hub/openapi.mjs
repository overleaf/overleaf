export function getOpenApiSpec(serverUrl = '') {
  return {
    openapi: '3.0.3',
    info: {
      title: 'COSL Overleaf Package Hub API',
      version: '1.0.0',
      description:
        'Unified TeX Live, CTAN, Custom Upload, and Community Package Set management API for Overleaf Community Edition.',
      license: {
        name: 'AGPL-3.0-only',
        url: 'https://www.gnu.org/licenses/agpl-3.0.html',
      },
    },
    servers: [
      {
        url: serverUrl || '/',
        description: 'Same-origin Overleaf web proxy',
      },
    ],
    tags: [
      { name: 'Packages', description: 'Discover, search, install, update, and remove packages' },
      { name: 'Custom Uploads', description: 'Upload and dry-run validate .sty/.cls/.zip/.tar.gz files' },
      { name: 'Jobs', description: 'Asynchronous job tracking & Server-Sent Events (SSE)' },
      { name: 'Sources', description: 'TeX Live mirrors & Community package set manifests' },
      { name: 'Admin & Persistence', description: 'Filesystem reconciliation, snapshots & audit log' },
    ],
    paths: {
      '/api/packages': {
        get: {
          tags: ['Packages'],
          summary: 'List aggregated packages from all sources',
          parameters: [
            { name: 'source', in: 'query', schema: { type: 'string', enum: ['all', 'texlive', 'ctan', 'custom', 'community'] } },
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['all', 'installed', 'available', 'updates', 'custom', 'community'] } },
            { name: 'sort', in: 'query', schema: { type: 'string', enum: ['name', 'size', 'recent'] } },
            { name: 'q', in: 'query', schema: { type: 'string' } },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 24 } },
          ],
          responses: {
            200: { description: 'Paginated package list and source counts' },
          },
        },
      },
      '/api/packages/installed': {
        get: {
          tags: ['Packages'],
          summary: 'List installed TeX Live & local packages',
          responses: { 200: { description: 'Array of installed packages' } },
        },
      },
      '/api/packages/search': {
        get: {
          tags: ['Packages'],
          summary: 'Search across TeX Live, CTAN, custom, and community sources',
          parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Matching packages' } },
        },
      },
      '/api/packages/updates': {
        get: {
          tags: ['Packages'],
          summary: 'List installed TeX Live packages with available updates',
          responses: { 200: { description: 'Packages with update_available=true' } },
        },
      },
      '/api/packages/audit': {
        get: {
          tags: ['Admin & Persistence'],
          summary: 'List immutable package mutation audit log entries',
          responses: { 200: { description: 'Audit log records' } },
        },
      },
      '/api/packages/docs': {
        get: {
          tags: ['Admin & Persistence'],
          summary: 'OpenAPI 3.0 specification for the Package Hub API',
          responses: { 200: { description: 'OpenAPI JSON document' } },
        },
      },
      '/api/packages/{name}': {
        get: {
          tags: ['Packages'],
          summary: 'Get detailed package metadata, dependencies, license, and runfiles',
          parameters: [
            { name: 'name', in: 'path', required: true, schema: { type: 'string', pattern: '^[a-zA-Z0-9._-]+$' } },
          ],
          responses: {
            200: { description: 'Detailed package object' },
            404: { description: 'Package not found' },
          },
        },
      },
      '/api/packages/install': {
        post: {
          tags: ['Packages'],
          summary: 'Enqueue asynchronous package installation',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['names'],
                  properties: {
                    names: { type: 'array', items: { type: 'string', pattern: '^[a-zA-Z0-9._-]+$' } },
                    source: { type: 'string', enum: ['texlive', 'ctan', 'community'] },
                  },
                },
              },
            },
          },
          responses: {
            202: { description: 'Job queued ({ jobId })' },
            400: { description: 'Invalid package name' },
          },
        },
      },
      '/api/packages/remove': {
        post: {
          tags: ['Packages'],
          summary: 'Enqueue package removal (blocks protected core packages)',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['names'],
                  properties: {
                    names: { type: 'array', items: { type: 'string' } },
                    source: { type: 'string', enum: ['texlive', 'ctan', 'custom'] },
                  },
                },
              },
            },
          },
          responses: {
            202: { description: 'Job queued ({ jobId })' },
            409: { description: 'Protected package cannot be removed' },
          },
        },
      },
      '/api/packages/update': {
        post: {
          tags: ['Packages'],
          summary: 'Update specific or all TeX Live packages',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    names: { type: 'array', items: { type: 'string' } },
                    all: { type: 'boolean' },
                  },
                },
              },
            },
          },
          responses: { 202: { description: 'Update job queued' } },
        },
      },
      '/api/packages/upload/validate': {
        post: {
          tags: ['Custom Uploads'],
          summary: 'Dry-run validate a .sty/.cls/.bst/.zip/.tar.gz package using pdflatex',
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: {
                    file: { type: 'string', format: 'binary' },
                    packageName: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Dry-run validation result and LaTeX compile log' } },
        },
      },
      '/api/packages/upload': {
        post: {
          tags: ['Custom Uploads'],
          summary: 'Upload, validate, and install a custom package into texmf-local',
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: {
                    file: { type: 'string', format: 'binary' },
                    packageName: { type: 'string' },
                    description: { type: 'string' },
                    version: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { 202: { description: '{ jobId, packageName }' } },
        },
      },
      '/api/packages/custom/{name}': {
        delete: {
          tags: ['Custom Uploads'],
          summary: 'Delete an uploaded custom package',
          parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: '{ ok: true }' } },
        },
      },
      '/api/packages/reconcile': {
        post: {
          tags: ['Admin & Persistence'],
          summary: 'Scan texmf-local and reconcile package DB state',
          responses: { 200: { description: 'Reconciliation report' } },
        },
      },
      '/api/packages/snapshot': {
        post: {
          tags: ['Admin & Persistence'],
          summary: 'Admin-only: Create container image or persistent state snapshot',
          responses: { 200: { description: 'Snapshot result' } },
        },
      },
      '/api/jobs/{jobId}': {
        get: {
          tags: ['Jobs'],
          summary: 'Poll job status, progress, and terminal log',
          parameters: [{ name: 'jobId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Job object' } },
        },
      },
      '/api/jobs/{jobId}/stream': {
        get: {
          tags: ['Jobs'],
          summary: 'Subscribe to live Server-Sent Events for job progress & log streaming',
          parameters: [{ name: 'jobId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'text/event-stream' } },
        },
      },
      '/api/sources': {
        get: {
          tags: ['Sources'],
          summary: 'List configured package sources and live health metrics',
          responses: { 200: { description: 'Array of source statuses' } },
        },
      },
      '/api/sources/community': {
        get: {
          tags: ['Sources'],
          summary: 'List registered community package set manifests',
          responses: { 200: { description: 'Array of community manifests' } },
        },
        post: {
          tags: ['Sources'],
          summary: 'Admin-only: Register a community package set manifest by URL or JSON',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    manifestUrl: { type: 'string', format: 'uri' },
                    manifest: { type: 'object' },
                  },
                },
              },
            },
          },
          responses: { 200: { description: '{ ok: true, manifest }' } },
        },
      },
      '/api/sources/texlive/mirror': {
        post: {
          tags: ['Sources'],
          summary: 'Admin-only: Set active TeX Live repository mirror',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['url'],
                  properties: { url: { type: 'string', format: 'uri' } },
                },
              },
            },
          },
          responses: { 200: { description: '{ ok: true, mirrorUrl }' } },
        },
      },
    },
  }
}
