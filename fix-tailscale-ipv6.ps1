$ErrorActionPreference = 'Stop'
Write-Host "=== Fix Tailscale IPv6 issue ===" -ForegroundColor Cyan

$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
$entryHost = 'controlplane.tailscale.com'
$entryIp   = '192.200.0.104'  # one of the published IPv4 addresses; round-robin pool, all valid

Write-Host "`n[1/4] Backing up hosts file..." -ForegroundColor Yellow
Copy-Item $hostsPath "$hostsPath.bak" -Force
Write-Host "  Backup at $hostsPath.bak" -ForegroundColor Green

Write-Host "`n[2/4] Adding IPv4 override for $entryHost..." -ForegroundColor Yellow
$current = Get-Content $hostsPath -Raw
if ($current -match [regex]::Escape($entryHost)) {
    Write-Host "  Entry already exists - skipping." -ForegroundColor DarkYellow
} else {
    Add-Content -Path $hostsPath -Value "`r`n# Tailscale - force IPv4 to bypass broken IPv6 routing`r`n$entryIp $entryHost"
    Write-Host "  Added: $entryIp $entryHost" -ForegroundColor Green
}

Write-Host "`n[3/4] Flushing DNS cache..." -ForegroundColor Yellow
ipconfig /flushdns | Out-Null
Write-Host "  Flushed." -ForegroundColor Green

Write-Host "`n[4/4] Restarting Tailscale..." -ForegroundColor Yellow
Stop-Service Tailscale -Force
Get-Process tailscaled,'tailscale-ipn' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Start-Service Tailscale
Start-Sleep -Seconds 3
Start-Process 'C:\Program Files\Tailscale\tailscale-ipn.exe'
Start-Sleep -Seconds 4

Write-Host "`n--- Status ---" -ForegroundColor Cyan
& 'C:\Program Files\Tailscale\tailscale.exe' status

Write-Host "`n=== Next step ===" -ForegroundColor Cyan
Write-Host "If status says 'Logged out', click the Tailscale tray icon (bottom-right) to sign in."
Write-Host "Then SSH from Mac: ssh rfkih@100.119.4.83"
Write-Host "`nPress Enter to close." -ForegroundColor Cyan
Read-Host | Out-Null
