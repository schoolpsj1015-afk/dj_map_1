@echo off
chcp 65001 > nul
echo ========================================================
echo   부산 편의점 상권 지도 로컬 웹서버 실행기
echo ========================================================
echo.
echo 브라우저에서 아래 주소로 접속하시거나,
echo 단순히 index.html 파일을 더블클릭하셔도 바로 작동합니다!
echo.
echo 주소: http://localhost:8080
echo.
echo 서버를 종료하려면 Ctrl+C를 누르세요.
echo.

powershell -NoProfile -Command "$port = 8080; $listener = New-Object System.Net.HttpListener; $listener.Prefixes.Add('http://localhost:' + $port + '/'); $listener.Start(); Write-Host '웹서버가 시작되었습니다: http://localhost:8080'; Start-Process 'http://localhost:8080/index.html'; while ($listener.IsListening) { $context = $listener.GetContext(); $request = $context.Request; $response = $context.Response; $path = $request.Url.LocalPath.TrimStart('/'); if ([string]::IsNullOrEmpty($path)) { $path = 'index.html' }; $filePath = Join-Path $PWD $path; if (Test-Path $filePath -PathType Leaf) { $ext = [System.IO.Path]::GetExtension($filePath); $mime = switch ($ext) { '.html' {'text/html; charset=utf-8'} '.css' {'text/css'} '.js' {'application/javascript'} '.json' {'application/json'} default {'application/octet-stream'} }; $response.ContentType = $mime; $bytes = [System.IO.File]::ReadAllBytes($filePath); $response.ContentLength64 = $bytes.Length; $response.OutputStream.Write($bytes, 0, $bytes.Length) } else { $response.StatusCode = 404 }; $response.Close() }"
pause
