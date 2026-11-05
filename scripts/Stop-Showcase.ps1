$ErrorActionPreference='Stop'
$statePath=Join-Path (Split-Path -Parent $PSScriptRoot) 'artifacts\showcase-state.json'
if(-not(Test-Path -LiteralPath $statePath)){Write-Host 'No showcase is recorded.';return}
$state=Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
foreach($kind in @('gateway','tunnel','showcase')){
 $processId=$state.($kind+'Pid')
 $started=$state.($kind+'Start')
 if(-not $processId){continue}
 $process=Get-Process -Id $processId -ErrorAction SilentlyContinue
 if($process){
  if($process.StartTime.ToUniversalTime().ToString('O') -ne $started){throw "Process ID $processId was reused. Refusing to stop another process."}
  Stop-Process -Id $processId
 }
}
Remove-Item -LiteralPath $statePath
Write-Host 'Public showcase stopped. The local app and saved integrations remain available.'
