// Resolve ESM imports through Yarn PnP.
//
// Yarn ships .pnp.loader.mjs for use with module.register(), which runs hooks on a dedicated
// thread — a second V8 isolate costing 50-110MB in every node process, whether or not the
// loader does any work. registerHooks() runs synchronously in-thread instead, and PnP's own
// resolveRequest already applies "exports" conditions, so the hook is just a lookup.
import { registerHooks, isBuiltin, createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import path from 'node:path'

const pnp = createRequire(import.meta.url)('pnpapi')

registerHooks({
  resolve(specifier, context, nextResolve) {
    // require() is patched by .pnp.cjs, and builtins never reach the filesystem.
    if (context.conditions.includes('require') || isBuiltin(specifier)) {
      return nextResolve(specifier, context)
    }
    // Only bare specifiers need PnP. The entrypoint arrives as a path, and mocha imports test
    // files by file:// URL; both are already resolved.
    let url
    if (specifier.startsWith('file://')) {
      url = specifier
    } else if (!context.parentURL) {
      url = pathToFileURL(specifier).href
    } else {
      // Tools installed outside the project — npm, corepack — bring their own node_modules.
      // PnP does not own those paths and refuses to resolve from them.
      const issuer = path.dirname(fileURLToPath(context.parentURL)) + '/'
      if (!pnp.findPackageLocator(issuer)) {
        return nextResolve(specifier, context)
      }
      try {
        url = pathToFileURL(
          pnp.resolveRequest(specifier, issuer, {
            conditions: new Set(context.conditions),
          })
        ).href
      } catch (err) {
        // PnP reports a missing module with the CommonJS code. require() returned above, so this is an ESM import and node's own resolver would raise the ESM code, which is what callers of an optional import catch.
        if (err.code === 'MODULE_NOT_FOUND') err.code = 'ERR_MODULE_NOT_FOUND'
        throw err
      }
    }
    try {
      // Keep the resolved path in the chain so loaders registered later can still mock it.
      return nextResolve(url, context)
    } catch (err) {
      // Node cannot look inside PnP's zips, nor at its __virtual__ paths, so PnP's answer is
      // final for those. Everything else — a genuinely missing file, an error raised by
      // another loader — is a real failure.
      if (url.includes('/__virtual__/') || url.includes('.zip/')) {
        return { url, shortCircuit: true }
      }
      throw err
    }
  },
})
