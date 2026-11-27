<#
.SYNOPSIS
  Orbit SAST baseline: runs every SAST tool the same way each time and stores the evidence.

.DESCRIPTION
  Follows security/sast/01-SAST-Plan.md. Output goes to security/sast/reports/raw/<date>/ (git-ignored),
  together with a manifest of tool versions, the git commit scanned and SHA-256 hashes of every report.

  Tools needed (see plan section 4): Node/npm, Semgrep, Gitleaks, Trivy.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File security/sast/run-sast.ps1
#>
$ErrorActionPreference = 'Continue'
$root = (git rev-parse --show-toplevel).Trim()
Set-Location $root

# Pick up tools installed by winget/pip in this session.
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
$env:PYTHONUTF8 = '1'

$stamp = Get-Date -Format 'yyyy-MM-dd_HHmm'
$out = Join-Path $root "security/sast/reports/raw/$stamp"
New-Item -ItemType Directory -Force $out | Out-Null

function Write-Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }

# Scope: server, web, packages and deployment files. The mobile app (apps/mobile) is out of scope.
Write-Step '1/5 Dependencies (npm audit)'
cmd /c "npm audit --json > `"$out\npm-audit-root.json`""

Write-Step '2/5 Code patterns (Semgrep, metrics off)'
semgrep scan --metrics=off `
  --config p/owasp-top-ten --config p/typescript --config p/javascript --config p/react `
  --config p/nodejs --config p/secrets --config p/dockerfile `
  --json --output "$out/semgrep.json" `
  --sarif-output "$out/semgrep.sarif" --quiet

Write-Step '3/5 Secrets in git history (Gitleaks)'
gitleaks git . --config .gitleaks.toml --redact --no-banner --report-format json --report-path "$out/gitleaks-history.json"

Write-Step '4/5 Secrets in tracked files (Gitleaks)'
gitleaks dir . --config .gitleaks.toml --redact --no-banner --report-format json --report-path "$out/gitleaks-workingtree.json"

Write-Step '5/5 Dependencies, IaC/Docker config, secrets (Trivy)'
trivy fs . --scanners vuln,misconfig,secret --skip-dirs '**/node_modules' --skip-dirs '**/.next' --skip-dirs 'apps/mobile' `
  --skip-files '.env' --skip-files '.env.production.local' `
  --format json --output "$out/trivy-fs.json" --quiet

Write-Step 'Manifest'
$manifest = [ordered]@{
  scan_started  = $stamp
  git_commit    = (git rev-parse HEAD).Trim()
  git_branch    = (git rev-parse --abbrev-ref HEAD).Trim()
  git_dirty     = [bool](git status --porcelain)
  node          = (node -v)
  npm           = (npm -v)
  semgrep       = (semgrep --version)
  gitleaks      = (gitleaks version)
  trivy         = ((trivy --version | Select-Object -First 1) -replace 'Version:\s*', '')
  report_sha256 = @{}
}
Get-ChildItem $out -File | Where-Object Name -ne 'manifest.json' | ForEach-Object {
  $manifest.report_sha256[$_.Name] = (Get-FileHash $_.FullName -Algorithm SHA256).Hash
}
$manifest | ConvertTo-Json -Depth 4 | Out-File "$out/manifest.json" -Encoding utf8

Write-Host "`nDone. Evidence saved in $out" -ForegroundColor Green
Write-Host 'Next: triage every result into security/sast/03-Findings-Register.md (plan section 7).'
