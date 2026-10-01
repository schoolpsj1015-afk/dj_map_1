@echo off
chcp 65001 > nul
title 부산 전체 상권 지도 (web2) 로컬 서버
echo ========================================================
echo   부산 전체 상권 지도 (web2) 로컬 웹서버 실행기
echo ========================================================
echo.
echo 브라우저에서 아래 주소로 접속하시거나,
echo 단순히 index.html 파일을 더블클릭하셔도 바로 작동합니다!
echo.
echo 주소: http://localhost:8082
echo.
echo 서버를 종료하려면 이 창을 닫거나 Ctrl+C를 누르세요.
echo.

powershell -NoProfile -Command "$port = 8082; $listener = New-Object System.Net.HttpListener; $listener.Prefixes.Add('http://localhost:' + $port + '/'); $listener.Start(); Write-Host '웹서버가 시작되었습니다: http://localhost:8082'; Start-Process 'http://localhost:8082/index.html'; while ($listener.IsListening) { $context = $listener.GetContext(); $request = $context.Request; $response = $context.Response; $path = $request.Url.LocalPath.TrimStart('/'); if ([string]::IsNullOrEmpty($path)) { $path = 'index.html' }; $filePath = Join-Path $PWD $path; if (Test-Path $filePath -PathType Leaf) { $ext = [System.IO.Path]::GetExtension($filePath); $mime = switch ($ext) { '.html' {'text/html; charset=utf-8'} '.css' {'text/css'} '.js' {'application/javascript; charset=utf-8'} '.json' {'application/json; charset=utf-8'} default {'application/octet-stream'} }; $response.ContentType = $mime; $bytes = [System.IO.File]::ReadAllBytes($filePath); $response.ContentLength64 = $bytes.Length; $response.OutputStream.Write($bytes, 0, $bytes.Length) } else { $response.StatusCode = 404 }; $response.Close() }"
pause
