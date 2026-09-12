Option Explicit
Dim sDir, oShell
sDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
Set oShell = CreateObject("WScript.Shell")
' CMD oynasini ko'rsatmasdan npm start ishga tushirish (0 = hidden)
oShell.Run "cmd /c cd /d " & Chr(34) & sDir & Chr(34) & " && npm start", 0, False
