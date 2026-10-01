@echo off
chcp 65001 > nul
title Push to GitHub
echo ========================================================
echo   GitHub 자동 커밋 및 푸시 (Push to GitHub)
echo   Repository: https://github.com/schoolpsj1015-afk/dj_map_1
echo ========================================================
echo.
echo [1/3] 변경 사항 스테이징 중 (git add)...
git add -A

echo.
echo [2/3] 커밋 생성 중 (git commit)...
git commit -m "feat: 부산 전체 상가 상권 지도(web2) 구축 및 사용량 초과 멈춤 해결, 통합 포털 추가"

echo.
echo [3/3] GitHub 원격 저장소로 푸시 중 (git push)...
git push -u origin main

echo.
echo ========================================================
echo   완료되었습니다!
echo   GitHub Pages 반영까지 약 1~2분이 소요될 수 있습니다.
echo ========================================================
pause