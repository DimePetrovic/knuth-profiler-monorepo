$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..
python -m uvicorn warm_joern.main:app --host 127.0.0.1 --port 7070 --reload
