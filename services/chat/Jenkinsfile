String cron_string = BRANCH_NAME == "master" ? "@daily" : ""

pipeline {
  agent any

  triggers {
    pollSCM('* * * * *')
    cron(cron_string)
  }

  stages {
    stage('Install') {
      agent {
        docker {
          image 'node:8.11.1'
          args "-v /var/lib/jenkins/.npm:/tmp/.npm -e HOME=/tmp"
          reuseNode true
        }
      }
      steps {
        // we need to disable logallrefupdates, else git clones 
        // during the npm install will require git to lookup the 
        // user id which does not exist in the container's 
        // /etc/passwd file, causing the clone to fail.
        sh 'git config --global core.logallrefupdates false'
        sh 'rm -rf node_modules'
        sh 'npm install && npm rebuild'
      }
    }

    stage('Compile') {
      agent {
        docker {
          image 'node:8.11.1'
          reuseNode true
        }
      }
      steps {
        sh 'npm run compile:all'
      }
    }

    stage('Unit Tests') {
      steps {
        sh 'DOCKER_COMPOSE_FLAGS="-f docker-compose.ci.yml" make test_unit'
      }
    }

    stage('Acceptance Tests') {
      steps {
        sh 'DOCKER_COMPOSE_FLAGS="-f docker-compose.ci.yml" make test_acceptance'
      }
    }

    stage('Package and publish build') {
      steps {
        sh 'echo ${BUILD_NUMBER} > build_number.txt'
        sh 'touch build.tar.gz' // Avoid tar warning about files changing during read
        sh 'tar -czf build.tar.gz --exclude=build.tar.gz --exclude-vcs .'
        withAWS(credentials:'S3_CI_BUILDS_AWS_KEYS', region:"${S3_REGION_BUILD_ARTEFACTS}") {
            s3Upload(file:'build.tar.gz', bucket:"${S3_BUCKET_BUILD_ARTEFACTS}", path:"${JOB_NAME}/${BUILD_NUMBER}.tar.gz")
        }
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
