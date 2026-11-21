# Screenshot helper for dev/QA only (not app runtime code).
# Usage: powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/screenshot.ps1 -Out m0-screen.png
# DSH shell processes are not DPI aware; without DPI awareness CopyFromScreen only
# captures the virtualized logical area and misses windows near the physical edges.
param(
  [string]$Out = "screen.png",
  [int]$X = -1,
  [int]$Y = -1,
  [int]$W = -1,
  [int]$H = -1
)
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class DpiHelper {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("shcore.dll")] public static extern int SetProcessDpiAwareness(int value);
}
"@
try { [DpiHelper]::SetProcessDpiAwareness(2) | Out-Null } catch { [DpiHelper]::SetProcessDPIAware() | Out-Null }
[System.Windows.Forms.Application]::EnableVisualStyles() | Out-Null

$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
if ($X -ge 0 -and $Y -ge 0 -and $W -gt 0 -and $H -gt 0) {
  $rect = New-Object System.Drawing.Rectangle($X, $Y, $W, $H)
} else {
  $rect = $screen
}
$bmp = New-Object System.Drawing.Bitmap($rect.Width, $rect.Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($rect.X, $rect.Y, 0, 0, $rect.Size)
$path = Join-Path -Path (Get-Location).Path -ChildPath $Out
$bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
Write-Output "saved $path ($($rect.Width)x$($rect.Height) at $($rect.X),$($rect.Y))"
