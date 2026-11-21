@echo off
chcp 65001 >nul
title 桌面待办 · 交互原型
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  未检测到 Node.js。可先安装 Node.js，或让 DSH 启动服务后直接访问：
  echo  http://127.0.0.1:8765/app/index.html
  echo.
  pause
  exit /b 1
)
echo 正在启动交互原型 ...
start "" "http://127.0.0.1:8765/app/index.html"
node server.mjs
pause
