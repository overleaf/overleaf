String cron_string = BRANCH_NAME == "master" ? "@daily" : ""

pipeline {
  agent any

  environment {
    GIT_PROJECT = "chat-sharelatex"
    JENKINS_WORKFLOW = "chat-sharelatex"
    TARGET_URL = "${env.JENKINS_URL}blue/organizations/jenkins/${JENKINS_WORKFLOW}/detail/$BRANCH_NAME/$BUILD_NUMBER/pipeline"
    GIT_API_URL = "https://api.github.com/repos/sharelatex/${GIT_PROJECT}/statuses/$GIT_COMMIT"
  }

  triggers {
    pollSCM('* * * * *')
    cron(cron_string)
  }

  stages {
    stage('Install') {
      agent {
        docker {
          image 'node:6.14.1'
          args "-v /var/lib/jenkins/.npm:/tmp/.npm -e HOME=/tmp"
          reuseNode true
        }
      }
      steps {
        withCredentials([usernamePassword(credentialsId: 'GITHUB_INTEGRATION', usernameVariable: 'GH_AUTH_USERNAME', passwordVariable: 'GH_AUTH_PASSWORD')]) {
          sh "curl $GIT_API_URL \
            --data '{ \
            \"state\" : \"pending\", \
            \"target_url\": \"$TARGET_URL\", \
            \"description\": \"Your build is underway\", \
            \"context\": \"ci/jenkins\" }' \
            -u $GH_AUTH_USERNAME:$GH_AUTH_PASSWORD"
        }
        // we need to disable logallrefupdates, else git clones
        // during the npm install will require git to lookup the
        // user id which does not exist in the container's
        // /etc/passwd file, causing the clone to fail.
        sh 'git config --global core.logallrefupdates false'
        sh 'rm -rf node_modules'
        sh 'npm install && npm rebuild'
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
      sh 'make clean'
    }

    success {
      withCredentials([usernamePassword(credentialsId: 'GITHUB_INTEGRATION', usernameVariable: 'GH_AUTH_USERNAME', passwordVariable: 'GH_AUTH_PASSWORD')]) {
        sh "curl $GIT_API_URL \
          --data '{ \
          \"state\" : \"success\", \
          \"target_url\": \"$TARGET_URL\", \
          \"description\": \"Your build succeeded!\", \
          \"context\": \"ci/jenkins\" }' \
          -u $GH_AUTH_USERNAME:$GH_AUTH_PASSWORD"
      }
    }

    failure {
      mail(from: "${EMAIL_ALERT_FROM}",
           to: "${EMAIL_ALERT_TO}",
           subject: "Jenkins build failed: ${JOB_NAME}:${BUILD_NUMBER}",
           body: "Build: ${BUILD_URL}")
      withCredentials([usernamePassword(credentialsId: 'GITHUB_INTEGRATION', usernameVariable: 'GH_AUTH_USERNAME', passwordVariable: 'GH_AUTH_PASSWORD')]) {
        sh "curl $GIT_API_URL \
          --data '{ \
          \"state\" : \"failure\", \
          \"target_url\": \"$TARGET_URL\", \
          \"description\": \"Your build failed\", \
          \"context\": \"ci/jenkins\" }' \
          -u $GH_AUTH_USERNAME:$GH_AUTH_PASSWORD"
      }
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
