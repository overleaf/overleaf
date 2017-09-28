pipeline {

  agent any

  triggers {
    pollSCM('* * * * *')
    cron('@daily')
  }

  stages {
    stage('Clean') {
      steps {
        // This is a terrible hack to set the file ownership to jenkins:jenkins so we can cleanup the directory
        sh 'docker run -v $(pwd):/app --rm busybox /bin/chown -R 111:119 /app'
        sh 'rm -fr node_modules'
      }
    }
    stage('Install') {
      agent {
        docker {
          image 'node:6.11.2'
          args "-v /var/lib/jenkins/.npm:/tmp/.npm -e HOME=/tmp"
          reuseNode true
        }
      }
      steps {
        sh 'git config --global core.logallrefupdates false'
        sh 'rm -fr node_modules'
        checkout([$class: 'GitSCM', branches: [[name: '*/master']], extensions: [[$class: 'RelativeTargetDirectory', relativeTargetDir: '_docker-runner'], [$class: 'CloneOption', shallow: true]], userRemoteConfigs: [[credentialsId: 'GIT_DEPLOY_KEY', url: 'git@github.com:sharelatex/docker-runner-sharelatex']]])
        sh 'npm install ./_docker-runner'
        sh 'rm -fr ./_docker-runner ./_docker-runner@tmp'
        sh 'npm install'
        sh 'npm rebuild'
        sh 'npm install --quiet grunt-cli'
      }
    }
    stage('Compile and Test') {
      agent {
        docker {
          image 'node:6.11.2'
          reuseNode true
        }
      }
      steps {
        sh 'node_modules/.bin/grunt compile:app'
        sh 'node_modules/.bin/grunt compile:acceptance_tests'
        sh 'NODE_ENV=development node_modules/.bin/grunt test:unit'
      }
    }
    stage('Acceptance Tests') {
      environment {
        TEXLIVE_IMAGE="quay.io/sharelatex/texlive-full:2017.1"
      }
      steps {
        sh 'mkdir -p compiles cache'
        // Not yet running, due to volumes/sibling containers
        sh 'docker container prune -f'
        sh 'docker pull $TEXLIVE_IMAGE'
        sh 'docker pull sharelatex/acceptance-test-runner:clsi-6.11.2'
        sh 'docker run --rm -e SIBLING_CONTAINER_USER=root -e SANDBOXED_COMPILES_HOST_DIR=$(pwd)/compiles -e SANDBOXED_COMPILES_SIBLING_CONTAINERS=true -e TEXLIVE_IMAGE=$TEXLIVE_IMAGE -v /var/run/docker.sock:/var/run/docker.sock -v $(pwd):/app sharelatex/acceptance-test-runner:clsi-6.11.2'
        // This is a terrible hack to set the file ownership to jenkins:jenkins so we can cleanup the directory
        sh 'docker run -v $(pwd):/app --rm busybox /bin/chown -R 111:119 /app'
        sh 'rm -r compiles cache server.log db.sqlite config/settings.defaults.coffee'
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
