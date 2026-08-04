$WScriptShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)

$TargetBat = "E:\Nana\Video\OpenCut\opencut-final\OpenCut.bat"
$WorkDir = "E:\Nana\Video\OpenCut\opencut-final"
$IconFile = "E:\Nana\Video\OpenCut\opencut-final\opencut.ico"

# Create Desktop Shortcut
$ShortcutDesktop = $WScriptShell.CreateShortcut("$DesktopPath\OpenCut Classic.lnk")
$ShortcutDesktop.TargetPath = $TargetBat
$ShortcutDesktop.WorkingDirectory = $WorkDir
$ShortcutDesktop.IconLocation = "$IconFile,0"
$ShortcutDesktop.Description = "OpenCut Classic - Video Editor"
$ShortcutDesktop.Save()

# Create Folder Shortcut inside opencut-final
$ShortcutFolder = $WScriptShell.CreateShortcut("$WorkDir\OpenCut Classic.lnk")
$ShortcutFolder.TargetPath = $TargetBat
$ShortcutFolder.WorkingDirectory = $WorkDir
$ShortcutFolder.IconLocation = "$IconFile,0"
$ShortcutFolder.Description = "OpenCut Classic - Video Editor"
$ShortcutFolder.Save()

Write-Host "Desktop & Folder shortcuts updated to point to OpenCut.bat!"
