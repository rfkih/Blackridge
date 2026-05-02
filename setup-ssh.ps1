#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'

Write-Host "=== Blackheart SSH Setup ===" -ForegroundColor Cyan

Write-Host "`n[1/5] Checking OpenSSH Server capability..." -ForegroundColor Yellow
$cap = Get-WindowsCapability -Online | Where-Object Name -like 'OpenSSH.Server*'
Write-Host ("  State: {0}" -f $cap.State)

if ($cap.State -ne 'Installed') {
    Write-Host "`n[2/5] Installing OpenSSH Server (this can take a minute)..." -ForegroundColor Yellow
    Add-WindowsCapability -Online -Name $cap.Name | Out-Null
    Write-Host "  Installed." -ForegroundColor Green
} else {
    Write-Host "`n[2/5] Already installed - skipping." -ForegroundColor Green
}

Write-Host "`n[3/5] Starting sshd service and enabling auto-start..." -ForegroundColor Yellow
Set-Service -Name sshd -StartupType 'Automatic'
Start-Service sshd
$svc = Get-Service sshd
Write-Host ("  sshd: {0} / {1}" -f $svc.Status, $svc.StartType) -ForegroundColor Green

Write-Host "`n[4/5] Ensuring firewall rule for port 22..." -ForegroundColor Yellow
$rule = Get-NetFirewallRule -Name 'sshd' -ErrorAction SilentlyContinue
if (-not $rule) {
    New-NetFirewallRule -Name sshd -DisplayName 'OpenSSH Server (sshd)' `
        -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22 | Out-Null
    Write-Host "  Created firewall rule." -ForegroundColor Green
} else {
    Write-Host "  Rule already exists." -ForegroundColor Green
}

Write-Host "`n[5/5] Connection details for your MacBook:" -ForegroundColor Yellow
$user = $env:USERNAME
$ips = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.InterfaceAlias -notmatch 'Loopback|vEthernet|WSL' -and $_.PrefixOrigin -ne 'WellKnown' } |
    Select-Object -ExpandProperty IPAddress
Write-Host ("  Username : {0}" -f $user) -ForegroundColor White
Write-Host  "  Local IPs:" -ForegroundColor White
foreach ($ip in $ips) { Write-Host ("    - {0}" -f $ip) -ForegroundColor White }

Write-Host "`nFrom your MacBook (same Wi-Fi/LAN), run:" -ForegroundColor Cyan
foreach ($ip in $ips) { Write-Host ("  ssh {0}@{1}" -f $user, $ip) -ForegroundColor White }

Write-Host "`nDone. Press Enter to close." -ForegroundColor Cyan
Read-Host | Out-Null
