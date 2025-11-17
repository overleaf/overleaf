/* eslint-disable */
import { extractImports, findJSAndImports } from './esm-check-migration.mjs'
import path from 'node:path'
import fs from 'node:fs'

const imports = await findJSAndImports(
  ['app', 'modules'].map(dir => path.resolve(dir))
)

const entryPoint = fs.existsSync('app.js') ? 'app.js' : 'app.mjs'
imports.set(path.resolve(entryPoint), extractImports(entryPoint))

const moduleImports = new Map()
imports.forEach((deps, module) => {
  for (const dep of deps) {
    if (!moduleImports.has(dep)) {
      moduleImports.set(dep, new Set())
    }
    moduleImports.set(dep, moduleImports.get(dep).add(module))
  }
})

const soloImports = new Map()
moduleImports.forEach((importedBy, module) => {
  if (importedBy.size === 1) {
    soloImports.set(module, [...importedBy][0])
  }
})

console.log(soloImports)

for (const [module, importedBy] of soloImports) {
  if (!moduleImports.has(importedBy)) {
    console.log(
      `${module} is only imported by ${importedBy}, which has no other imports`
    )
  }
  if (soloImports.has(importedBy)) {
    console.log(
      `${module} is only imported by ${importedBy}, which is only imported by ${soloImports.get(importedBy)}`
    )
  }
  const chains = findDependencyChainsToTarget(imports, module)
  const conversionsToMake = chains.reduce((conversions, chain) => {
    chain.forEach(dep => {
      conversions.add(dep)
    })
    return conversions
  }, new Set())

  if (conversionsToMake.length < 10) {
    console.log(
      `To convert ${module}, would need to convert: ${[...conversionsToMake].length}`
    )
  }
}

// --- Circular dependency detection ---
function findCircularDependencies(importsMap) {
  const cycles = []
  const visited = new Set()
  const stack = []

  function dfs(file, pathStack) {
    if (pathStack.includes(file)) {
      // Cycle detected
      const cycleStart = pathStack.indexOf(file)
      cycles.push(pathStack.slice(cycleStart).concat(file))
      return
    }
    if (!importsMap.has(file)) return
    pathStack.push(file)
    for (const imp of importsMap.get(file)) {
      const resolvedImp = path.resolve(imp)
      dfs(resolvedImp, pathStack)
    }
    pathStack.pop()
  }

  for (const file of importsMap.keys()) {
    dfs(file, [])
  }
  return cycles
}

const cycles = findCircularDependencies(imports)
if (cycles.length > 0) {
  console.log('Circular dependencies found:')
  for (const cycle of cycles) {
    console.log('  ' + cycle.join(' -> '))
  }
} else {
  console.log('No circular dependencies detected.')
}

// --- Find all chains of dependencies to a target file ---
function findDependencyChainsToTarget(importsMap, targetPath) {
  const chains = []
  const resolvedTarget = path.resolve(targetPath)

  function dfs(current, pathStack) {
    if (pathStack.includes(current)) return // avoid cycles
    pathStack.push(current)
    if (current === resolvedTarget) {
      chains.push([...pathStack])
      pathStack.pop()
      return
    }
    if (!importsMap.has(current)) {
      pathStack.pop()
      return
    }
    for (const imp of importsMap.get(current)) {
      const resolvedImp = path.resolve(imp)
      dfs(resolvedImp, pathStack)
    }
    pathStack.pop()
  }

  for (const file of importsMap.keys()) {
    if (file === resolvedTarget) continue // skip self
    dfs(file, [])
  }
  return chains
}

// Example usage: set your target file path here
const targetFile =
  '/Users/arumble/Documents/Projects/internal/services/web/app/src/Features/Analytics/AnalyticsManager.js' // <-- change to your target
const chains = findDependencyChainsToTarget(imports, targetFile)
if (chains.length > 0) {
  console.log(`Dependency chains leading to ${targetFile}:`)
  for (const chain of chains) {
    console.log('  ' + chain.join(' -> '))
  }
} else {
  console.log(`No dependency chains found leading to ${targetFile}.`)
}

const conversionsToMake = chains.reduce((conversions, chain) => {
  chain.forEach(dep => {
    conversions.add(dep)
  })
  return conversions
}, new Set())

console.log([...conversionsToMake].join(' '))
