@echo off
chcp 65001 >nul
title 学考冲刺通 · 班级版
cd /d "%~dp0"
echo 正在启动班级版服务...
python -I "班级版服务.py"
if errorlevel 1 (
  echo.
  echo 启动失败：请确认已安装 Python 3（https://www.python.org）
  pause
)
