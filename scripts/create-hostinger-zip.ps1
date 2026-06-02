param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Args)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$target = Join-Path $scriptDir 'reservas/deploy/create-hostinger-zip.ps1'
& powershell -ExecutionPolicy Bypass -File $target @Args
exit $LASTEXITCODE
