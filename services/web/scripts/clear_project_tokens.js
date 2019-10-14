const ProjectDetailsHandler = require('../app/src/Features/Project/ProjectDetailsHandler')
const projectId = process.argv[2]

if (!/^(?=[a-f\d]{24}$)(\d+[a-f]|[a-f]+\d)/.test(projectId)) {
  console.error('Usage: node clear_project_tokens.js projectId')
  process.exit(1)
}

ProjectDetailsHandler.clearTokens(projectId, err => {
  if (err) {
    console.error(
      `Error clearing project tokens from project ${projectId}`,
      err
    )
    process.exit(1)
  }
  console.log(`Successfully cleared project tokens from project ${projectId}`)
  process.exit(0)
})
