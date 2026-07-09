Set WshShell = CreateObject("WScript.Shell")
' 0 = Ocultar la ventana
WshShell.Run chr(34) & "e:\fcardene\Utiles\Repositorio_DevOps\Horario\ARRANCAR_APLICACION.bat" & Chr(34), 0
Set WshShell = Nothing
