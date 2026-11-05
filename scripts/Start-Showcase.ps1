param([string]$CloudflaredPath)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
$artifacts=Join-Path $projectRoot 'artifacts'
New-Item -ItemType Directory -Force -Path $artifacts | Out-Null
$statePath=Join-Path $artifacts 'showcase-state.json'
if(Test-Path -LiteralPath $statePath){
 $previous=Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
 if((Get-Process -Id $previous.tunnelPid -ErrorAction SilentlyContinue) -and (Get-Process -Id $previous.gatewayPid -ErrorAction SilentlyContinue)) {Write-Host "Showcase already running: $($previous.url)";return}
 throw 'A previous showcase state exists. Run scripts\Stop-Showcase.ps1 before starting a new link.'
}
$health=Invoke-RestMethod 'http://127.0.0.1:5080/api/health'
if($health.status -ne 'ok'){throw 'Start Lead Desk first with scripts\Start-LeadDesk.ps1 -Https.'}
if(-not $CloudflaredPath){$CloudflaredPath=Join-Path (Split-Path -Parent $projectRoot) '.tools\cloudflared.exe'}
if(-not(Test-Path -LiteralPath $CloudflaredPath)){
 New-Item -ItemType Directory -Force -Path (Split-Path -Parent $CloudflaredPath) | Out-Null
 Invoke-WebRequest 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile $CloudflaredPath
}
$tunnel=$null;$gateway=$null;$showcase=$null
try {
 $showcaseData=Join-Path $artifacts 'showcase-data'
 $showcaseDb=Join-Path $showcaseData 'showcase.db'
 if(-not(Test-Path -LiteralPath $showcaseDb)){
  & node (Join-Path $PSScriptRoot 'prepare-showcase.mjs')
  if($LASTEXITCODE){throw 'Could not prepare an isolated showcase workspace.'}
 }
 $sdkCandidate=Join-Path (Split-Path -Parent $projectRoot) '.tools\dotnet\dotnet.exe'
 if(-not(Test-Path -LiteralPath $sdkCandidate)){$sdkCandidate=Join-Path $projectRoot '.tools\dotnet\dotnet.exe'}
 if(-not(Test-Path -LiteralPath $sdkCandidate)){$sdkCandidate=(Get-Command dotnet -ErrorAction Stop).Source}
 if(Get-NetTCPConnection -LocalPort 5084 -State Listen -ErrorAction SilentlyContinue){throw 'Port 5084 is already in use. Stop the previous showcase first.'}
 $serverRoot=Join-Path $projectRoot 'server'
 $showcase=Start-Process -FilePath $sdkCandidate -ArgumentList @('bin/Debug/net10.0/LeadDesk.dll','--urls','http://127.0.0.1:5084','--Database:Provider','Sqlite','--Database:ConnectionString',('"Data Source='+$showcaseDb+'"'),'--DataDirectory',('"'+$showcaseData+'"')) -WorkingDirectory $serverRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $artifacts 'showcase-app.log') -RedirectStandardError (Join-Path $artifacts 'showcase-app-error.log')
 $ready=$false
 for($attempt=0;$attempt -lt 30;$attempt++){
  try{$result=Invoke-RestMethod 'http://127.0.0.1:5084/api/health';if($result.status -eq 'ok'){$ready=$true;break}}catch{}
  if($showcase.HasExited){throw 'The isolated showcase app exited. Check artifacts\showcase-app-error.log.'}
  Start-Sleep -Milliseconds 500
 }
 if(-not $ready){throw 'The isolated showcase app did not start.'}
 $tunnelLog=Join-Path $artifacts 'showcase-tunnel.log'
 $tunnel=Start-Process -FilePath $CloudflaredPath -ArgumentList @('tunnel','--url','http://127.0.0.1:5085','--protocol','http2','--no-autoupdate') -WindowStyle Hidden -PassThru -RedirectStandardError $tunnelLog -RedirectStandardOutput (Join-Path $artifacts 'showcase-tunnel-out.log')
 $shareUrl=$null
 for($attempt=0;$attempt -lt 60;$attempt++){
  if($tunnel.HasExited){throw 'The tunnel exited. Inspect artifacts\showcase-tunnel.log.'}
  if(Test-Path -LiteralPath $tunnelLog){$logText=[string](Get-Content -LiteralPath $tunnelLog -Raw);$match=[regex]::Match($logText,'https://[a-z0-9-]+\.trycloudflare\.com');if($match.Success){$shareUrl=$match.Value;break}}
  Start-Sleep -Milliseconds 500
 }
 if(-not $shareUrl){throw 'No showcase address was issued. Inspect artifacts\showcase-tunnel.log.'}
 $oldOrigin=$env:LEAD_DESK_SHARE_ORIGIN
 try {
  $env:LEAD_DESK_SHARE_ORIGIN=$shareUrl
  $node=(Get-Command node -ErrorAction Stop).Source
  $gateway=Start-Process -FilePath $node -ArgumentList @('"'+(Join-Path $PSScriptRoot 'share-server.mjs')+'"') -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $artifacts 'showcase-gateway.log') -RedirectStandardError (Join-Path $artifacts 'showcase-gateway-error.log')
 }finally{$env:LEAD_DESK_SHARE_ORIGIN=$oldOrigin}
 Start-Sleep -Milliseconds 500
 if($gateway.HasExited){throw 'The public gateway exited. Check artifacts\showcase-gateway-error.log.'}
 $state=@{url=$shareUrl;tunnelPid=$tunnel.Id;gatewayPid=$gateway.Id;showcasePid=$showcase.Id;tunnelStart=$tunnel.StartTime.ToUniversalTime().ToString('O');gatewayStart=$gateway.StartTime.ToUniversalTime().ToString('O');showcaseStart=$showcase.StartTime.ToUniversalTime().ToString('O');startedAt=[DateTime]::UtcNow.ToString('O')}
 $state | ConvertTo-Json | Set-Content -LiteralPath $statePath
 Write-Host "Public live showcase: $shareUrl"
 Write-Host 'Anyone with this link can use the separate showcase pipeline and real AI. Existing leads and activity are not copied.'
 Write-Host 'Showcase owner controls and extension pairing codes: http://127.0.0.1:5084/#settings'
 Write-Host 'Keep this computer running. Stop sharing with scripts\Stop-Showcase.ps1.'
}catch{
 if($gateway -and -not $gateway.HasExited){Stop-Process -Id $gateway.Id}
 if($tunnel -and -not $tunnel.HasExited){Stop-Process -Id $tunnel.Id}
 if($showcase -and -not $showcase.HasExited){Stop-Process -Id $showcase.Id}
 throw
}
