param(
  [Parameter(Position = 0)]
  [ValidateSet('pause', 'off', 'stop', 'resume', 'on', 'start', 'backup', 'status', 'help')]
  [string]$Action = 'status',

  [switch]$Restore,

  [string]$ArchivePath = ''
)

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ParentDir = Split-Path -Parent $ScriptDir

if ($env:OVERLEAF_TOOLKIT_DIR -and (Test-Path $env:OVERLEAF_TOOLKIT_DIR)) {
  $ToolkitRoot = $env:OVERLEAF_TOOLKIT_DIR
} elseif (Test-Path (Join-Path $ParentDir 'config\overleaf.rc')) {
  $ToolkitRoot = $ParentDir
} elseif (Test-Path (Join-Path $ParentDir 'overleaf-toolkit\config\overleaf.rc')) {
  $ToolkitRoot = Join-Path $ParentDir 'overleaf-toolkit'
} elseif (Test-Path (Join-Path $HOME 'overleaf-toolkit\config\overleaf.rc')) {
  $ToolkitRoot = Join-Path $HOME 'overleaf-toolkit'
} else {
  $ToolkitRoot = $ParentDir
}

$Sharelatex = if ($env:OVERLEAF_SHARELATEX_CONTAINER) { $env:OVERLEAF_SHARELATEX_CONTAINER } else { 'sharelatex' }
$Mongo = if ($env:OVERLEAF_MONGO_CONTAINER) { $env:OVERLEAF_MONGO_CONTAINER } else { 'mongo' }
$Redis = if ($env:OVERLEAF_REDIS_CONTAINER) { $env:OVERLEAF_REDIS_CONTAINER } else { 'redis' }
$MongoDb = if ($env:OVERLEAF_MONGO_DB) { $env:OVERLEAF_MONGO_DB } else { 'sharelatex' }
$BackupDir = if ($env:OVERLEAF_BACKUP_DIR) { $env:OVERLEAF_BACKUP_DIR } else { Join-Path $ToolkitRoot 'data\backups\hibernate' }
$KeepBackups = 5

$Port = '80'
$RcPath = Join-Path $ToolkitRoot 'config\overleaf.rc'
if (Test-Path $RcPath) {
  $PortLine = Get-Content $RcPath | Where-Object { $_ -match '^OVERLEAF_PORT=' } | Select-Object -Last 1
  if ($PortLine) {
    $Port = ($PortLine -split '=', 2)[1].Trim().Trim('"')
  }
}
if ($env:OVERLEAF_PORT) { $Port = $env:OVERLEAF_PORT }

function Assert-Docker {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'docker CLI not found in PATH.'
  }
  $null = docker info 2>$null
  if ($LASTEXITCODE -ne 0) {
    throw 'Docker daemon is not running or not reachable.'
  }
}

function Test-ContainerRunning([string]$Name) {
  $out = docker inspect -f '{{.State.Running}}' $Name 2>$null
  return ($LASTEXITCODE -eq 0 -and $out.Trim() -eq 'true')
}

function Test-ContainerExists([string]$Name) {
  $null = docker inspect $Name 2>$null
  return ($LASTEXITCODE -eq 0)
}

function Get-MongoCounts {
  $script = "const d = db.getSiblingDB('$MongoDb'); print(JSON.stringify({ users: d.users.countDocuments({}), projects: d.projects.countDocuments({}), docs: d.docs.countDocuments({}), workspaceSettings: d.workspaceSettings.countDocuments({}) }));"
  $raw = docker exec -e NODE_OPTIONS=--max-old-space-size=96 $Mongo mongosh --quiet --eval $script 2>$null | Select-Object -Last 1
  if ($LASTEXITCODE -eq 0 -and $raw) {
    return ($raw | ConvertFrom-Json)
  }
  return [PSCustomObject]@{ users = -1; projects = -1; docs = -1; workspaceSettings = -1 }
}

function Invoke-BinaryProcessToFile([string]$FileName, [string[]]$Arguments, [string]$OutPath) {
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $FileName
  $psi.Arguments = ($Arguments -join ' ')
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $proc = [System.Diagnostics.Process]::Start($psi)
  try {
    $fs = [System.IO.File]::Create($OutPath)
    try {
      $proc.StandardOutput.BaseStream.CopyTo($fs)
    } finally {
      $fs.Dispose()
    }
    $errText = $proc.StandardError.ReadToEnd()
    $proc.WaitForExit()
    if ($proc.ExitCode -ne 0) {
      throw "Command failed ($($proc.ExitCode)): $errText"
    }
  } finally {
    $proc.Dispose()
  }
}

function Invoke-FileToBinaryProcess([string]$FileName, [string[]]$Arguments, [string]$InPath) {
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $FileName
  $psi.Arguments = ($Arguments -join ' ')
  $psi.UseShellExecute = $false
  $psi.RedirectStandardInput = $true
  $psi.RedirectStandardError = $true
  $proc = [System.Diagnostics.Process]::Start($psi)
  try {
    $fs = [System.IO.File]::OpenRead($InPath)
    try {
      $fs.CopyTo($proc.StandardInput.BaseStream)
    } finally {
      $fs.Dispose()
      $proc.StandardInput.Close()
    }
    $errText = $proc.StandardError.ReadToEnd()
    $proc.WaitForExit()
    if ($proc.ExitCode -ne 0) {
      throw "Command failed ($($proc.ExitCode)): $errText"
    }
  } finally {
    $proc.Dispose()
  }
}

function Test-GzipArchive([string]$Path) {
  $fs = [System.IO.File]::OpenRead($Path)
  try {
    $b1 = $fs.ReadByte()
    $b2 = $fs.ReadByte()
    if ($b1 -ne 0x1F -or $b2 -ne 0x8B) { return $false }
    $fs.Position = 0
    $gz = New-Object System.IO.Compression.GzipStream($fs, [System.IO.Compression.CompressionMode]::Decompress)
    try {
      $buf = New-Object byte[] 65536
      while ($gz.Read($buf, 0, $buf.Length) -gt 0) {}
    } finally {
      $gz.Dispose()
    }
    return $true
  } catch {
    return $false
  } finally {
    $fs.Dispose()
  }
}

function Invoke-Backup {
  if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
  }
  if (-not (Test-ContainerRunning $Mongo)) {
    throw "MongoDB container '$Mongo' is not running; cannot create database backup."
  }

  $counts = Get-MongoCounts
  $ts = (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss')
  $archiveFile = Join-Path $BackupDir "$MongoDb-$ts.archive.gz"
  $latestFile = Join-Path $BackupDir 'latest.archive.gz'

  Write-Host "[backup] Querying live database counts ($MongoDb): users=$($counts.users), projects=$($counts.projects)"
  Write-Host "[backup] Dumping MongoDB database '$MongoDb' -> $archiveFile ..."
  Invoke-BinaryProcessToFile 'docker' @('exec', $Mongo, 'mongodump', '--db', $MongoDb, '--archive', '--gzip') $archiveFile

  if (-not (Test-Path $archiveFile) -or (Get-Item $archiveFile).Length -eq 0) {
    throw "MongoDB backup archive is empty: $archiveFile"
  }
  if (-not (Test-GzipArchive $archiveFile)) {
    throw "MongoDB backup archive failed gzip integrity verification: $archiveFile"
  }

  $sha = (Get-FileHash -Path $archiveFile -Algorithm SHA256).Hash.ToLowerInvariant()
  Copy-Item -Path $archiveFile -Destination $latestFile -Force
  "$sha  latest.archive.gz" | Set-Content -Path (Join-Path $BackupDir 'latest.archive.gz.sha256') -Encoding UTF8

  if (Test-ContainerRunning $Redis) {
    Write-Host '[backup] Flushing Redis state cleanly to disk...'
    $null = docker exec $Redis redis-cli SAVE 2>$null
    $null = docker cp "${Redis}:/data/dump.rdb" (Join-Path $BackupDir 'redis-latest.rdb') 2>$null
  }

  $state = [ordered]@{
    timestampUtc = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    database     = $MongoDb
    archiveFile  = (Split-Path -Leaf $archiveFile)
    latestFile   = 'latest.archive.gz'
    sha256       = $sha
    counts       = $counts
  }
  ($state | ConvertTo-Json -Depth 4) | Set-Content -Path (Join-Path $BackupDir 'latest-state.json') -Encoding UTF8

  $oldFiles = Get-ChildItem -Path $BackupDir -Filter "$MongoDb-*.archive.gz" | Sort-Object LastWriteTime -Descending | Select-Object -Skip $KeepBackups
  foreach ($f in $oldFiles) { Remove-Item -Path $f.FullName -Force }

  Write-Host "[ok] Verified backup saved: $latestFile (sha256: $sha)"
}

function Apply-MemoryLimits {
  if (Test-ContainerRunning $Mongo) {
    $null = docker update --memory 288m --memory-swap 512m $Mongo 2>$null
    $null = docker exec -e NODE_OPTIONS=--max-old-space-size=96 $Mongo mongosh --quiet --eval 'db.adminCommand({ setParameter: 1, wiredTigerEngineRuntimeConfig: "cache_size=128M" })' 2>$null
  }
  if (Test-ContainerRunning $Redis) {
    $null = docker update --memory 64m --memory-swap 96m $Redis 2>$null
    $null = docker exec $Redis redis-cli CONFIG SET maxmemory 48mb 2>$null
    $null = docker exec $Redis redis-cli CONFIG SET maxmemory-policy noeviction 2>$null
  }
  if (Test-ContainerRunning $Sharelatex) {
    $null = docker update --memory 1184m --memory-swap 1792m $Sharelatex 2>$null
  }
}

function Wait-MongoReady {
  for ($i = 0; $i -lt 45; $i++) {
    $null = docker exec -e NODE_OPTIONS=--max-old-space-size=96 $Mongo mongosh --quiet --eval 'db.adminCommand({ ping: 1 }).ok' 2>$null
    if ($LASTEXITCODE -eq 0) {
      $isPrim = (docker exec -e NODE_OPTIONS=--max-old-space-size=96 $Mongo mongosh --quiet --eval 'Boolean(db.hello().isWritablePrimary || db.hello().ismaster)' 2>$null | Select-Object -Last 1)
      if ($isPrim -and $isPrim.Trim() -eq 'true') { return }
      $null = docker exec -e NODE_OPTIONS=--max-old-space-size=96 $Mongo mongosh --quiet --eval 'try { rs.status().ok || rs.initiate({ _id: "overleaf", members: [{ _id: 0, host: "mongo:27017" }] }) } catch(e) { rs.initiate({ _id: "overleaf", members: [{ _id: 0, host: "mongo:27017" }] }) }' 2>$null
    }
    Start-Sleep -Seconds 1
  }
  throw 'Timed out waiting for MongoDB readiness.'
}

function Wait-RedisReady {
  for ($i = 0; $i -lt 30; $i++) {
    $pong = docker exec $Redis redis-cli ping 2>$null
    if ($pong -and $pong.Trim() -eq 'PONG') { return }
    Start-Sleep -Seconds 1
  }
  throw 'Timed out waiting for Redis readiness.'
}

function Wait-WebReady {
  $url = "http://127.0.0.1:${Port}/login"
  for ($i = 0; $i -lt 90; $i++) {
    try {
      $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
      if ($resp.StatusCode -eq 200) { return }
    } catch {}
    Start-Sleep -Seconds 1
  }
  Write-Warning "Overleaf web did not respond on $url within 90s; check logs."
}

switch ($Action.ToLowerInvariant()) {
  { $_ -in 'pause', 'off', 'stop' } {
    Assert-Docker
    Write-Host '=== Hibernating Overleaf Workspace (Pause & Backup) ==='
    if (Test-ContainerRunning $Sharelatex) {
      Write-Host "[stop] Gracefully stopping '$Sharelatex' (flushing open documents)..."
      $null = docker stop -t 60 $Sharelatex
    }
    if (Test-ContainerRunning $Mongo) {
      Invoke-Backup
    } else {
      Write-Host "[info] MongoDB container '$Mongo' already stopped; skipping dump."
    }
    foreach ($c in @($Redis, $Mongo)) {
      if (Test-ContainerRunning $c) {
        Write-Host "[stop] Stopping '$c'..."
        $null = docker stop -t 30 $c
      }
    }
    Write-Host ''
    Write-Host '[ok] Overleaf is now OFF. RAM used by Overleaf containers has been freed.'
    Write-Host "[ok] Snapshot saved: $(Join-Path $BackupDir 'latest.archive.gz')"
    Write-Host "Resume anytime with: `"$ScriptDir\overleaf-ctl.cmd`" resume"
  }

  { $_ -in 'resume', 'on', 'start' } {
    Assert-Docker
    Write-Host '=== Resuming Overleaf Workspace ==='
    if (-not (Test-ContainerExists $Mongo) -or -not (Test-ContainerExists $Redis) -or -not (Test-ContainerExists $Sharelatex)) {
      throw "Containers ($Mongo, $Redis, $Sharelatex) do not exist yet. Create them with docker compose up -d first."
    }
    Write-Host "[start] Starting '$Mongo' and '$Redis'..."
    $null = docker start $Mongo $Redis
    Wait-MongoReady
    Wait-RedisReady
    Apply-MemoryLimits

    $targetArchive = if ($ArchivePath) { $ArchivePath } else { Join-Path $BackupDir 'latest.archive.gz' }
    $liveCounts = Get-MongoCounts
    $statePath = Join-Path $BackupDir 'latest-state.json'
    $savedState = if (Test-Path $statePath) { Get-Content $statePath -Raw | ConvertFrom-Json } else { $null }

    $shouldRestore = $Restore.IsPresent
    if (-not $shouldRestore -and $liveCounts.users -eq 0 -and $liveCounts.projects -eq 0 -and (Test-Path $targetArchive) -and $savedState) {
      if ($savedState.counts.users -gt 0 -or $savedState.counts.projects -gt 0) {
        Write-Host "[restore] Live database is empty while snapshot records $($savedState.counts.users) user(s) / $($savedState.counts.projects) project(s). Restoring automatically..."
        $shouldRestore = $true
      }
    }

    if ($shouldRestore) {
      if (-not (Test-Path $targetArchive)) { throw "Restore archive not found: $targetArchive" }
      if (-not (Test-GzipArchive $targetArchive)) { throw "Archive failed gzip check: $targetArchive" }
      if ($savedState -and $targetArchive -eq (Join-Path $BackupDir 'latest.archive.gz')) {
        $actualSha = (Get-FileHash -Path $targetArchive -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($savedState.sha256 -and $actualSha -ne $savedState.sha256) {
          throw "SHA-256 mismatch on $targetArchive"
        }
      }
      Write-Host "[restore] Restoring MongoDB from $targetArchive ..."
      Invoke-FileToBinaryProcess 'docker' @('exec', '-i', $Mongo, 'mongorestore', '--archive', '--gzip', '--drop') $targetArchive
      $liveCounts = Get-MongoCounts
      Write-Host "[ok] Restored database state: users=$($liveCounts.users), projects=$($liveCounts.projects)"
    } else {
      Write-Host "[ok] Live MongoDB data intact (users=$($liveCounts.users), projects=$($liveCounts.projects))."
    }

    if (-not (Test-ContainerRunning $Sharelatex)) {
      Write-Host "[start] Starting '$Sharelatex'..."
      $null = docker start $Sharelatex
    }
    Apply-MemoryLimits
    Write-Host "[wait] Waiting for Overleaf web on http://localhost:${Port} ..."
    Wait-WebReady
    Write-Host ''
    Write-Host "[ok] Overleaf is ONLINE at http://localhost:${Port}"
    docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}' $Sharelatex $Mongo $Redis
  }

  'backup' {
    Assert-Docker
    Invoke-Backup
  }

  'status' {
    Assert-Docker
    Write-Host '=== Overleaf Workspace Status ==='
    docker ps -a --filter "name=^/(${Sharelatex}|${Mongo}|${Redis})$" --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
    Write-Host ''
    $running = @($Sharelatex, $Mongo, $Redis | Where-Object { Test-ContainerRunning $_ })
    if ($running.Count -gt 0) {
      Write-Host '=== Live Memory Budget (Target <= 1.5 GB total) ==='
      docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}' @running
    }
    $statePath = Join-Path $BackupDir 'latest-state.json'
    Write-Host ''
    if (Test-Path $statePath) {
      Write-Host '=== Latest Hibernate Snapshot ==='
      Get-Content $statePath -Raw
    } else {
      Write-Host "No hibernate snapshot taken yet (directory: $BackupDir)."
    }
  }

  default {
    Write-Host 'Usage: overleaf-ctl.cmd <pause|off|resume|on|backup|status> [-Restore] [-ArchivePath <path>]'
  }
}
