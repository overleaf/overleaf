String cron_string = BRANCH_NAME == "master" ? "@daily" : ""

pipeline {
  agent any

  triggers {
    pollSCM('* * * * *')
    cron(cron_string)
  }

  stages {
    stage('CI') {
      steps {
        sh 'make ci'
      }
    }

    stage('Publish build number') {
      steps {
        sh 'echo ${BRANCH_NAME}-${BUILD_NUMBER} > build_number.txt'
        withAWS(credentials:'S3_CI_BUILDS_AWS_KEYS', region:"${S3_REGION_BUILD_ARTEFACTS}") {
            // The deployment process uses this file to figure out the latest build
            s3Upload(file:'build_number.txt', bucket:"${S3_BUCKET_BUILD_ARTEFACTS}", path:"${JOB_NAME}/latest")
        }
      }
    }
  }

  post {
    always {
      sh 'DOCKER_COMPOSE_FLAGS="-f docker-compose.ci.yml" make test_clean'
    }

    failure {
      mail(from: "${EMAIL_ALERT_FROM}",
           to: "${EMAIL_ALERT_TO}",
           subject: "Jenkins build failed: ${JOB_NAME}:${BUILD_NUMBER}",
           body: "Build: ${BUILD_URL}")
    }
  }

  // The options directive is for configuration that applies to the whole job.
  options {
    // we'd like to make sure remove old builds, so we don't fill up our storage!
    buildDiscarder(logRotator(numToKeepStr:'50'))

    // And we'd really like to be sure that this build doesn't hang forever, so let's time it out after:
    timeout(time: 30, unit: 'MINUTES')
  }
}
