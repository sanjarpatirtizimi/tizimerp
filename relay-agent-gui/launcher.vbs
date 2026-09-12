Option Explicit
Dim sDir, oShell, sCmd

' Bu faylning papkasini topish
sDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)

Set oShell = CreateObject("WScript.Shell")

' start.bat orqali ishga tushirish — eng ishonchli usul
sCmd = Chr(34) & sDir & "\start.bat" & Chr(34)
oShell.Run sCmd, 1, False
