String cron_string = BRANCH_NAME == "master" ? "@daily" : ""

pipeline {

  agent any

  environment  {
      HOME = "/tmp"
      GIT_PROJECT = "web-sharelatex-internal"
      JENKINS_WORKFLOW = "web-sharelatex-internal"
      TARGET_URL = "${env.JENKINS_URL}blue/organizations/jenkins/${JENKINS_WORKFLOW}/detail/$BRANCH_NAME/$BUILD_NUMBER/pipeline"
      GIT_API_URL = "https://api.github.com/repos/sharelatex/${GIT_PROJECT}/statuses/$GIT_COMMIT"
  }

  triggers {
    pollSCM('* * * * *')
    cron(cron_string)
  }

  stages {
    stage('Pre') {
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
      }
    }

    stage('Copy external pages') {
      steps {
        sh 'bin/copy_external_pages'
      }
    }

    stage('Install') {
      agent {
        docker {
          image 'node:6.9.5'
          args "-v /var/lib/jenkins/.npm:/tmp/.npm"
          reuseNode true
        }
      }
      steps {
        sh 'git config --global core.logallrefupdates false'
        sh 'rm -rf node_modules/'
        sh 'npm install --quiet'
        sh 'npm rebuild'
        // It's too easy to end up shrinkwrapping to an outdated version of translations.
        // Ensure translations are always latest, regardless of shrinkwrap
        sh 'npm install git+https://github.com/sharelatex/translations-sharelatex.git#master'
      }
    }

    stage('Compile') {
      agent {
        docker {
          image 'node:6.9.5'
          reuseNode true
        }
      }
      steps {
        sh 'make clean compile_full'
        // replace the build number placeholder for sentry
        sh 'node_modules/.bin/grunt version'
      }
    }

    stage('Lint') {
      agent {
        docker {
          image 'node:6.9.5'
          reuseNode true
        }
      }
      steps {
        sh 'make --no-print-directory lint'
      }
    }

    stage('Test and Minify') {
      parallel {
        stage('Unit Test') {
          agent {
            docker {
              image 'node:6.9.5'
              reuseNode true
            }
          }
          steps {
            sh 'make --no-print-directory test_unit MOCHA_ARGS="--reporter tap"'
          }
        }

        stage('Acceptance Test') {
          steps {
            // Spawns its own docker containers
            sh 'make --no-print-directory test_acceptance MOCHA_ARGS="--reporter tap"'
          }
        }

        stage('Minify') {
          agent {
            docker {
              image 'node:6.9.5'
              reuseNode true
            }
          }
          steps {
            sh 'WEBPACK_ENV=production make minify'
          }
        }
      }
    }

    stage('Frontend Unit Test') {
      steps {
        // Spawns its own docker containers
        sh 'make --no-print-directory test_frontend'
      }
    }

    stage('Package') {
      steps {
        sh 'rm -rf ./node_modules/grunt*'
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

    stage('Sync OSS') {
      when {
        branch 'master'
      }
      agent {
        docker {
          image 'sharelatex/copybara'
          args "-u 0:0 -v /tmp/copybara:/root/copybara/cache"
        }
      }
      steps {
        sshagent (credentials: ['GIT_DEPLOY_KEY']) {
          sh 'git config --global user.name Copybot'
          sh 'git config --global user.email copybot@overleaf.com'
          sh 'mkdir -p /root/.ssh'
          sh 'ssh-keyscan github.com >> /root/.ssh/known_hosts'
          sh 'COPYBARA_CONFIG=./copybara/copy.bara.sky copybara --git-committer-email=copybot@overleaf.com --git-committer-name=Copybot || true'
        }
      }
    }
  }

  post {
    always {
      sh 'make clean_ci'
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
    // Only build one at a time
    disableConcurrentBuilds()

    // we'd like to make sure remove old builds, so we don't fill up our storage!
    buildDiscarder(logRotator(numToKeepStr:'50'))

    // And we'd really like to be sure that this build doesn't hang forever, so let's time it out after:
    timeout(time: 30, unit: 'MINUTES')
  }
}
