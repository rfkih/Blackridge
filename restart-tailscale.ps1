$ErrorActionPreference = 'Stop'
Write-Host "=== Restarting Tailscale ===" -ForegroundColor Cyan

Write-Host "`n[1/3] Stopping Tailscale service..." -ForegroundColor Yellow
Stop-Service Tailscale -Force
Write-Host "  Stopped." -ForegroundColor Green

Write-Host "`n[2/3] Killing any lingering tailscaled / tailscale-ipn processes..." -ForegroundColor Yellow
Get-Process tailscaled,'tailscale-ipn' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "  Cleared." -ForegroundColor Green

Write-Host "`n[3/3] Starting Tailscale service..." -ForegroundColor Yellow
Start-Service Tailscale
Start-Sleep -Seconds 3
$svc = Get-Service Tailscale
Write-Host ("  Tailscale: {0} / {1}" -f $svc.Status, $svc.StartType) -ForegroundColor Green

Write-Host "`nWaiting 5s for daemon to talk to control plane..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host "`n--- Status ---" -ForegroundColor Cyan
& 'C:\Program Files\Tailscale\tailscale.exe' status

Write-Host "`nDone. You may also need to launch the Tailscale tray app from Start menu to log in." -ForegroundColor Cyan
Write-Host "Press Enter to close." -ForegroundColor Cyan
Read-Host | Out-Null
