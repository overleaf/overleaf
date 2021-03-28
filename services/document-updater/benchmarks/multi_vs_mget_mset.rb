require "benchmark"
require "redis"

N = (ARGV.first || 1).to_i
DOC_ID = (ARGV.last || "606072b20bb4d3109fb5b122")

@r = Redis.new


def get
  @r.get("doclines:{#{DOC_ID}}")
  @r.get("DocVersion:{#{DOC_ID}}")
  @r.get("DocHash:{#{DOC_ID}}")
  @r.get("ProjectId:{#{DOC_ID}}")
  @r.get("Ranges:{#{DOC_ID}}")
  @r.get("Pathname:{#{DOC_ID}}")
  @r.get("ProjectHistoryId:{#{DOC_ID}}")
  @r.get("UnflushedTime:{#{DOC_ID}}")
  @r.get("lastUpdatedAt:{#{DOC_ID}}")
  @r.get("lastUpdatedBy:{#{DOC_ID}}")
end

def mget
  @r.mget(
    "doclines:{#{DOC_ID}}",
    "DocVersion:{#{DOC_ID}}",
    "DocHash:{#{DOC_ID}}",
    "ProjectId:{#{DOC_ID}}",
    "Ranges:{#{DOC_ID}}",
    "Pathname:{#{DOC_ID}}",
    "ProjectHistoryId:{#{DOC_ID}}",
    "UnflushedTime:{#{DOC_ID}}",
    "lastUpdatedAt:{#{DOC_ID}}",
    "lastUpdatedBy:{#{DOC_ID}}",
    )
end

def set
  @r.set("doclines:{#{DOC_ID}}", "[\"@book{adams1995hitchhiker,\",\"  title={The Hitchhiker's Guide to the Galaxy},\",\"  author={Adams, D.},\",\"  isbn={9781417642595},\",\"  url={http://books.google.com/books?id=W-xMPgAACAAJ},\",\"  year={1995},\",\"  publisher={San Val}\",\"}\",\"\"]")
  @r.set("DocVersion:{#{DOC_ID}}", "0")
  @r.set("DocHash:{#{DOC_ID}}", "0075bb0629c6c13d0d68918443648bbfe7d98869")
  @r.set("ProjectId:{#{DOC_ID}}", "606072b20bb4d3109fb5b11e")
  @r.set("Ranges:{#{DOC_ID}}", "")
  @r.set("Pathname:{#{DOC_ID}}", "/references.bib")
  @r.set("ProjectHistoryId:{#{DOC_ID}}", "")
  @r.set("UnflushedTime:{#{DOC_ID}}", "")
  @r.set("lastUpdatedAt:{#{DOC_ID}}", "")
  @r.set("lastUpdatedBy:{#{DOC_ID}}", "")
end

def mset
  @r.mset(
    "doclines:{#{DOC_ID}}", "[\"@book{adams1995hitchhiker,\",\"  title={The Hitchhiker's Guide to the Galaxy},\",\"  author={Adams, D.},\",\"  isbn={9781417642595},\",\"  url={http://books.google.com/books?id=W-xMPgAACAAJ},\",\"  year={1995},\",\"  publisher={San Val}\",\"}\",\"\"]",
    "DocVersion:{#{DOC_ID}}", "0",
    "DocHash:{#{DOC_ID}}", "0075bb0629c6c13d0d68918443648bbfe7d98869",
    "ProjectId:{#{DOC_ID}}", "606072b20bb4d3109fb5b11e",
    "Ranges:{#{DOC_ID}}", "",
    "Pathname:{#{DOC_ID}}", "/references.bib",
    "ProjectHistoryId:{#{DOC_ID}}", "",
    "UnflushedTime:{#{DOC_ID}}", "",
    "lastUpdatedAt:{#{DOC_ID}}", "",
    "lastUpdatedBy:{#{DOC_ID}}", "",
    )
end


def benchmark_multi_get(benchmark, i)
  benchmark.report("#{i}: multi get") do
    N.times do
      @r.multi do
        get
      end
    end
  end
end

def benchmark_mget(benchmark, i)
  benchmark.report("#{i}: mget") do
    N.times do
      mget
    end
  end
end

def benchmark_multi_set(benchmark, i)
  benchmark.report("#{i}: multi set") do
    N.times do
      @r.multi do
        set
      end
    end
  end
end

def benchmark_mset(benchmark, i)
  benchmark.report("#{i}: mset") do
    N.times do
      mset
    end
  end
end


# init
set

Benchmark.bmbm do |benchmark|
  3.times do |i|
    benchmark_multi_get(benchmark, i)
    benchmark_mget(benchmark, i)
    benchmark_multi_set(benchmark, i)
    benchmark_mset(benchmark, i)
  end
end



=begin
# Results

I could not max out the redis-server process with this benchmark.
The ruby process hit 100% of a modern i7 CPU thread and the redis-server process
 barely hit 50% of a CPU thread.

Based on the timings below, mget is about 3 times faster and mset about 4 times
 faster than multiple get/set commands in a multi.
=end

=begin
$ redis-server --version
Redis server v=5.0.7 sha=00000000:0 malloc=jemalloc-5.2.1 bits=64 build=636cde3b5c7a3923
$ ruby multi_vs_mget_mset.rb 100000
Rehearsal ------------------------------------------------
0: multi get  12.132423   4.246689  16.379112 ( 16.420069)
0: mget        4.499457   0.947556   5.447013 (  6.274883)
0: multi set  12.685936   4.495241  17.181177 ( 17.225984)
0: mset        2.543401   0.913448   3.456849 (  4.554799)
1: multi get  13.397207   4.581881  17.979088 ( 18.027755)
1: mget        4.551287   1.160531   5.711818 (  6.579168)
1: multi set  13.018957   4.927175  17.946132 ( 17.987502)
1: mset        2.561096   1.048416   3.609512 (  4.780087)
2: multi get  13.224422   5.014475  18.238897 ( 18.284152)
2: mget        4.664434   1.051083   5.715517 (  6.592088)
2: multi set  12.972284   4.600422  17.572706 ( 17.613185)
2: mset        2.621344   0.984123   3.605467 (  4.766855)
------------------------------------- total: 132.843288sec

                   user     system      total        real
0: multi get  13.341552   4.900892  18.242444 ( 18.289912)
0: mget        5.056534   0.960954   6.017488 (  6.971189)
0: multi set  12.989880   4.823793  17.813673 ( 17.858393)
0: mset        2.543434   1.025352   3.568786 (  4.723040)
1: multi get  13.059379   4.674345  17.733724 ( 17.777859)
1: mget        4.698754   0.915637   5.614391 (  6.489614)
1: multi set  12.608293   4.729163  17.337456 ( 17.372993)
1: mset        2.645290   0.940584   3.585874 (  4.744134)
2: multi get  13.678224   4.732373  18.410597 ( 18.457525)
2: mget        4.716749   1.072064   5.788813 (  6.697683)
2: multi set  13.058710   4.889801  17.948511 ( 17.988742)
2: mset        2.311854   0.989166   3.301020 (  4.346467)
=end

=begin
# multi get/set run at about O(65'000) operations per second
$ redis-cli info | grep 'instantaneous_ops_per_sec'
instantaneous_ops_per_sec:65557

# mget runs at about O(15'000) operations per second
$ redis-cli info | grep 'instantaneous_ops_per_sec'
instantaneous_ops_per_sec:14580

# mset runs at about O(20'000) operations per second
$ redis-cli info | grep 'instantaneous_ops_per_sec'
instantaneous_ops_per_sec:20792

These numbers are pretty reasonable:
multi: 100'000 * 12 ops / 18s = 66'666 ops/s
mget : 100'000 *  1 ops  /  7s = 14'285 ops/s
mset : 100'000 *  1 ops  /  5s = 20'000 ops/s



Bonus: Running three benchmarks in parallel on different keys.
multi get: O(125'000) ops/s and 80% CPU load of redis-server
multi set: O(130'000) ops/s and 90% CPU load of redis-server
mget     : O( 30'000) ops/s and 70% CPU load of redis-server
mset     : O( 40'000) ops/s and 90% CPU load of redis-server
=end
