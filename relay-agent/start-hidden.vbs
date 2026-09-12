' Sanjar Patir Relay Agent — fon rejimda (oynasiz) ishga tushurish
' Bu fayl install.cmd tomonidan avtomatik ishlatiladi.

Dim sDir, sCmd
sDir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
sCmd = "cmd /c """ & "cd /d " & Chr(34) & sDir & Chr(34) & " && node index.js"""

Dim oShell
Set oShell = CreateObject("WScript.Shell")
' 0 = oyna ko'rinmaydi; False = kutmasdan davom etadi
oShell.Run sCmd, 0, False
Set oShell = Nothing
