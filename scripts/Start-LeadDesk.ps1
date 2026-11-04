param([switch]$Https,[switch]$NoBuild)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
$workspaceTools=Join-Path (Split-Path -Parent $projectRoot) '.tools'
$localTools=Join-Path $projectRoot '.tools'
$sdkCandidate=Join-Path $workspaceTools 'dotnet\dotnet.exe'
if(-not (Test-Path -LiteralPath $sdkCandidate)) { $sdkCandidate=Join-Path $localTools 'dotnet\dotnet.exe' }
if(-not (Test-Path -LiteralPath $sdkCandidate)) {
 $installed=Get-Command dotnet -ErrorAction SilentlyContinue
 if($installed -and (& $installed.Source --list-sdks | Where-Object {$_ -match '^10\.'})) {$sdkCandidate=$installed.Source}
 else {throw 'Install the .NET 10 SDK or run scripts\Setup.ps1 first.'}
}
$env:DOTNET_ROOT=Split-Path -Parent $sdkCandidate
$env:DOTNET_CLI_TELEMETRY_OPTOUT='1'
$env:DOTNET_CLI_HOME=Join-Path $workspaceTools 'dotnet-home'
$env:NUGET_PACKAGES=Join-Path $workspaceTools 'nuget'
$env:ASPNETCORE_ENVIRONMENT='Production'
if(-not $NoBuild) {
 Push-Location (Join-Path $projectRoot 'client')
 try {if(-not (Test-Path -LiteralPath 'node_modules')){npm.cmd ci --no-audit --no-fund;if($LASTEXITCODE){throw 'npm install failed.'}};npm.cmd run build;if($LASTEXITCODE){throw 'React build failed.'}} finally {Pop-Location}
 Push-Location (Join-Path $projectRoot 'server')
 try {& $sdkCandidate build;if($LASTEXITCODE){throw '.NET build failed.'}} finally {Pop-Location}
}
Push-Location (Join-Path $projectRoot 'server')
try {
 if($Https){Write-Host 'Open https://localhost:7443. Trust the ASP.NET development certificate before browser use (see README).'; & $sdkCandidate run --no-build --urls 'https://localhost:7443;http://127.0.0.1:5080'}
 else {Write-Host 'Open http://127.0.0.1:5080. Press Ctrl+C to stop. Data is preserved between runs.'; & $sdkCandidate run --no-build --urls 'http://127.0.0.1:5080'}
}finally{Pop-Location}
