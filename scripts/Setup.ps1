$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
$workspaceTools=Join-Path (Split-Path -Parent $projectRoot) '.tools'
$sdkCandidate=Join-Path $workspaceTools 'dotnet\dotnet.exe'
if(-not (Test-Path -LiteralPath $sdkCandidate)) {
 $installed=Get-Command dotnet -ErrorAction SilentlyContinue
 if(-not ($installed -and (& $installed.Source --list-sdks | Where-Object {$_ -match '^10\.'}))) {
  $sdkFolder=Join-Path $projectRoot '.tools'
  New-Item -ItemType Directory -Path $sdkFolder -Force | Out-Null
  $installer=Join-Path $sdkFolder 'dotnet-install.ps1'
  Invoke-WebRequest 'https://dot.net/v1/dotnet-install.ps1' -OutFile $installer
  & $installer -Channel 10.0 -InstallDir (Join-Path $sdkFolder 'dotnet') -NoPath
  if($LASTEXITCODE){throw '.NET SDK installation failed.'}
 }
}
& (Join-Path $PSScriptRoot 'Start-LeadDesk.ps1')
