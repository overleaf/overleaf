services = require('./services')

module.exports = (grunt) ->
        
        tag = grunt.option("tag") or 'latest'
        repos = []
        for service in services
                url = service.repo.split('/')
                owner = url[3]
                repo = url[4].replace('.git','')
                repos.push "/repos/#{owner}/#{repo}/git/refs/heads/#{service.version}"
        
        grunt.initConfig
                docker_io:
                        default_options:
                                options:
                                        dockerFileLocation: '.'
                                        buildName: 'sharelatex'
                                        tag: grunt.option('tag') or 'latest'
                                        push: grunt.option('push') or false
                                        force: true

                github:
                        combinedRevisions:
                                options:
                                        #oAuth:
                                        #        access_token: ''
                                        concat: true
                                src: repos
                                dest: 'version/' + tag + '.json'

        grunt.loadNpmTasks 'grunt-docker-io'
        grunt.loadNpmTasks 'grunt-github-api'

        grunt.registerTask 'build', ['docker_io', 'github']
        grunt.registerTask 'gitrev', ['github']

        grunt.registerTask 'default', ['build']
