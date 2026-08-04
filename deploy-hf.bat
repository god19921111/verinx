@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM ============================================================
REM VerinX · Hugging Face Spaces 一键部署脚本 (Windows)
REM 使用前请确保：
REM   1. 已安装 git
REM   2. 已在 https://huggingface.co 注册账号
REM   3. 已创建 Docker SDK 类型的 Space (https://huggingface.co/new-space)
REM   4. 已获取 Access Token (https://huggingface.co/settings/tokens, write权限)
REM ============================================================

echo.
echo ============================================================
echo   VerinX · Hugging Face Spaces 部署工具
echo ============================================================
echo.

REM ---------- 检查 git ----------
where git >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 git，请先安装：https://git-scm.com/
    pause
    exit /b 1
)

REM ---------- 配置 HF Space 信息 ----------
set "HF_USER="
set "HF_SPACE_NAME=verinx"
set "HF_TOKEN="

REM 读取配置文件（如果存在）
if exist ".hf-config" (
    for /f "tokens=1,2 delims==" %%a in (.hf-config) do (
        if "%%a"=="HF_USER" set "HF_USER=%%b"
        if "%%a"=="HF_SPACE_NAME" set "HF_SPACE_NAME=%%b"
        if "%%a"=="HF_TOKEN" set "HF_TOKEN=%%b"
    )
)

REM 交互式输入
if "%HF_USER%"=="" (
    set /p "HF_USER=请输入 Hugging Face 用户名: "
)

if "%HF_SPACE_NAME%"=="" (
    set /p "HF_SPACE_NAME=请输入 Space 名称 (默认 verinx): "
    if "!HF_SPACE_NAME!"=="" set "HF_SPACE_NAME=verinx"
)

if "%HF_TOKEN%"=="" (
    set /p "HF_TOKEN=请输入 HF Access Token (https://huggingface.co/settings/tokens): "
)

REM 保存配置（避免重复输入，token 保存在本地，注意安全）
if not exist ".hf-config" (
    (
        echo HF_USER=%HF_USER%
        echo HF_SPACE_NAME=%HF_SPACE_NAME%
        echo HF_TOKEN=%HF_TOKEN%
    ) > ".hf-config"
    echo [信息] 配置已保存到 .hf-config（已加入 .gitignore，不会泄露）
)

REM ---------- 构建仓库地址 ----------
set "HF_REPO_URL=https://%HF_USER%:%HF_TOKEN%@huggingface.co/spaces/%HF_USER%/%HF_SPACE_NAME%"
set "HF_SPACE_URL=https://huggingface.co/spaces/%HF_USER%/%HF_SPACE_NAME%"

echo.
echo [信息] 目标 Space: %HF_SPACE_URL%
echo.

REM ---------- 准备部署目录 ----------
set "DEPLOY_DIR=.hf-deploy"

if exist "%DEPLOY_DIR%" (
    echo [信息] 清理旧部署目录...
    rmdir /s /q "%DEPLOY_DIR%"
)

echo [信息] 创建部署目录...
mkdir "%DEPLOY_DIR%"

REM ---------- 克隆 HF Space 仓库（初始化） ----------
echo [信息] 克隆 HF Space 仓库...
git clone "%HF_REPO_URL%" "%DEPLOY_DIR%" 2>nul
if errorlevel 1 (
    echo [警告] 克隆失败，可能是新 Space 或仓库为空，将初始化新仓库...
    mkdir "%DEPLOY_DIR%"
    cd "%DEPLOY_DIR%"
    git init
    git remote add origin "%HF_REPO_URL%"
    cd ..
)

REM ---------- 复制项目文件 ----------
echo [信息] 复制项目文件...

REM 后端代码
xcopy "backend\app" "%DEPLOY_DIR%\backend\app\" /E /I /Y /Q >nul
xcopy "backend\sql" "%DEPLOY_DIR%\backend\sql\" /E /I /Y /Q >nul
copy "backend\requirements-deploy.txt" "%DEPLOY_DIR%\backend\requirements-deploy.txt" /Y >nul
copy "backend\.env.production" "%DEPLOY_DIR%\backend\.env.production" /Y >nul 2>nul

REM 前端代码（排除 node_modules 和 dist）
xcopy "frontend\src" "%DEPLOY_DIR%\frontend\src\" /E /I /Y /Q >nul
xcopy "frontend\public" "%DEPLOY_DIR%\frontend\public\" /E /I /Y /Q >nul 2>nul
copy "frontend\package.json" "%DEPLOY_DIR%\frontend\package.json" /Y >nul
copy "frontend\package-lock.json" "%DEPLOY_DIR%\frontend\package-lock.json" /Y >nul 2>nul
copy "frontend\vite.config.ts" "%DEPLOY_DIR%\frontend\vite.config.ts" /Y >nul 2>nul
copy "frontend\tsconfig.json" "%DEPLOY_DIR%\frontend\tsconfig.json" /Y >nul 2>nul
copy "frontend\tsconfig.node.json" "%DEPLOY_DIR%\frontend\tsconfig.node.json" /Y >nul 2>nul
copy "frontend\index.html" "%DEPLOY_DIR%\frontend\index.html" /Y >nul 2>nul

REM Docker 配置：Dockerfile.hf → Dockerfile
copy "backend\Dockerfile.hf" "%DEPLOY_DIR%\Dockerfile" /Y >nul

REM README：README_HF.md → README.md (HF 需要 YAML front matter)
copy "README_HF.md" "%DEPLOY_DIR%\README.md" /Y >nul

REM .dockerignore
copy ".dockerignore" "%DEPLOY_DIR%\.dockerignore" /Y >nul

REM .gitignore
echo node_modules/ > "%DEPLOY_DIR%\.gitignore"
echo __pycache__/ >> "%DEPLOY_DIR%\.gitignore"
echo *.pyc >> "%DEPLOY_DIR%\.gitignore"
echo .env >> "%DEPLOY_DIR%\.gitignore"
echo *.db >> "%DEPLOY_DIR%\.gitignore"
echo uploads/ >> "%DEPLOY_DIR%\.gitignore"
echo *.log >> "%DEPLOY_DIR%\.gitignore"

REM ---------- 提交并推送 ----------
echo.
echo [信息] 提交并推送到 Hugging Face...
cd "%DEPLOY_DIR%"

git add -A
git commit -m "deploy: VerinX $(date /t) $(time /t)" 2>nul

echo [信息] 推送中，请稍候（首次推送可能需要 1-2 分钟）...
git push -u origin main 2>nul
if errorlevel 1 (
    git push -u origin master 2>nul
)
if errorlevel 1 (
    git branch -M main
    git push -u origin main
)

cd ..

REM ---------- 清理 ----------
echo.
echo [信息] 清理临时部署目录...
rmdir /s /q "%DEPLOY_DIR%"

REM ---------- 完成 ----------
echo.
echo ============================================================
echo   ✅ 部署完成！
echo ============================================================
echo.
echo   📦 Space 地址: %HF_SPACE_URL%
echo   🔧 首次构建约需 5-10 分钟
echo   📋 请在 Space Settings → Repository secrets 中添加：
echo      - ZHIPU_API_KEY (智谱 API Key)
echo      - JWT_SECRET_KEY (随机密钥)
echo.
echo   查看构建日志: %HF_SPACE_URL%/logs
echo.
pause
