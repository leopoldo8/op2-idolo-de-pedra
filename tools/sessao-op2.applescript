on run
	startSession(true)
end run

on open location requestedUrl
	startSession(false)
end open location

on startSession(openPanel)
	set appPath to POSIX path of (path to me)
	set projectDir to do shell script "dirname " & quoted form of appPath
	set status to do shell script "/usr/bin/curl -s -o /dev/null -m 1 -w '%{http_code}' http://127.0.0.1:8765/api/gm || true"
	if status is "200" then
		if openPanel then do shell script "open -a 'Google Chrome' http://localhost:8765/index.html || open http://localhost:8765/index.html"
		return
	end if
	set browserFlag to " --no-browser"
	if openPanel then set browserFlag to ""
	do shell script "cd " & quoted form of projectDir & " && nohup /usr/bin/python3 -u servidor.py" & browserFlag & " > servidor.log 2>&1 &"
end startSession
