$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..
python -m app.worker
