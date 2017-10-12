pipeline {

  agent any
  
  triggers {
    pollSCM('* * * * *')
    cron('@daily')
  }

  stages {
    stage('Install') {
      agent {
        docker {
          image 'node:4.2.1'
          args "-v /var/lib/jenkins/.npm:/tmp/.npm -e HOME=/tmp"
          reuseNode true
        }
      }
      steps {
        // we need to disable logallrefupdates, else git clones during the npm install will require git to lookup the user id
        // which does not exist in the container's /etc/passwd file, causing the clone to fail.
        sh 'git config --global core.logallrefupdates false'
        sh 'rm -fr node_modules'
        sh 'npm install && npm rebuild'
        sh 'npm install --quiet grunt-cli'
      }
    }
    stage('Compile and Test') {
      agent {
        docker {
          image 'node:4.2.1'
          reuseNode true
        }
      }
      steps {
        sh 'node_modules/.bin/grunt install'
        sh 'node_modules/.bin/grunt compile:acceptance_tests'
        sh 'NODE_ENV=development node_modules/.bin/grunt test:unit'
      }
    }
    stage('Acceptance Tests') {
      steps {
        sh 'docker pull sharelatex/acceptance-test-runner'
        withCredentials([usernamePassword(credentialsId: 'S3_DOCSTORE_TEST_AWS_KEYS', passwordVariable: 'AWS_SECRET', usernameVariable: 'AWS_ID')]) {
          sh 'docker run --rm -e AWS_BUCKET="sl-doc-archive-testing" -e AWS_ACCESS_KEY_ID=$AWS_ID -e AWS_SECRET_ACCESS_KEY=$AWS_SECRET -v $(pwd):/app sharelatex/acceptance-test-runner'
        }
      }
    }
    stage('Package') {
      steps {
        sh 'echo ${BUILD_NUMBER} > build_number.txt'
        sh 'touch build.tar.gz' // Avoid tar warning about files changing during read
        sh 'tar -czf build.tar.gz --exclude=build.tar.gz --exclude-vcs .'
      }
    }
    stage('Publish') {
      steps {
        withAWS(credentials:'S3_CI_BUILDS_AWS_KEYS', region:"${S3_REGION_BUILD_ARTEFACTS}") {
            s3Upload(file:'build.tar.gz', bucket:"${S3_BUCKET_BUILD_ARTEFACTS}", path:"${JOB_NAME}/${BUILD_NUMBER}.tar.gz")
            // The deployment process uses this file to figure out the latest build
            s3Upload(file:'build_number.txt', bucket:"${S3_BUCKET_BUILD_ARTEFACTS}", path:"${JOB_NAME}/latest")
        }
      }
    }
  }

  post {
    failure {
      when {
        branch 'master'
      }
      
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
