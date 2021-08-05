namespace 'run' do
	desc "compiles and runs the spelling-sharelatex server"
	task :app => ["compile:app"] do
		sh %{node app.js | bunyan}
	end
end

namespace 'compile' do
	desc "compiles application files"
	task :app do
		FileUtils.rm_rf "app/js"
		sh %{coffee -c -o app/js/ app/coffee/} do |ok, res|
			if ! ok
				raise "error compiling app folder tests : #{res}"
			end
			puts 'finished app/coffee compile'
		end
		sh %{coffee -c app.coffee} do |ok, res|
			if ! ok
				raise "error compiling root app file: #{res}"
			end
			puts 'finished app.coffee compile'
		end
	end

	desc "compiles unit tests"
	task :unit_tests => ["compile:app"] do
		FileUtils.rm_rf "test/UnitTests/js"
		puts "Compiling Unit Tests to JS"
		sh %{coffee -c -o test/UnitTests/js/ test/UnitTests/coffee/} do |ok, res|
			if ! ok
				raise "error compiling tests : #{res}"
			end
			puts 'finished unit tests compile'
		end
	end
end

namespace 'test' do
	desc "Run Unit Tests"
	task :unit => ["compile:unit_tests"]do
		puts "Running Unit Tests"
		sh %{mocha -R spec test/UnitTests/js/*} do |ok, res|
			if ! ok
				raise "error running unit tests : #{res}"
			end
		end
	end
end
