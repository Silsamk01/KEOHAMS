@echo off
REM ===================================================================
REM cPanel Deployment Script for KEOHAMS Laravel Application (Windows)
REM ===================================================================
REM This script automates the deployment process to cPanel hosting
REM Usage: deploy-cpanel.bat [environment]
REM Example: deploy-cpanel.bat production
REM ===================================================================

setlocal enabledelayedexpansion

REM Configuration
set ENVIRONMENT=%1
if "%ENVIRONMENT%"=="" set ENVIRONMENT=production

set CPANEL_USER=ngfaczol
set CPANEL_HOST=server.keohams.com
set TIMESTAMP=%date:~-4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%

echo ========================================================
echo     cPanel Deployment Script - KEOHAMS (Windows)
echo ========================================================
echo.
echo Environment: %ENVIRONMENT%
echo Timestamp: %TIMESTAMP%
echo.

REM ===================================================================
REM Step 1: Pre-deployment Checks
REM ===================================================================
echo [1/8] Running pre-deployment checks...

if not exist ".env.%ENVIRONMENT%" (
    echo Error: .env.%ENVIRONMENT% file not found!
    exit /b 1
)

if not exist "artisan" (
    echo Error: Not in Laravel root directory!
    exit /b 1
)

echo Pre-deployment checks passed
echo.

REM ===================================================================
REM Step 2: Run Local Tests
REM ===================================================================
echo [2/8] Running tests locally...

if exist "vendor\bin\phpunit.bat" (
    call vendor\bin\phpunit.bat --testsuite Unit --stop-on-failure
    if errorlevel 1 (
        echo Tests failed! Deployment aborted.
        exit /b 1
    )
    echo Tests passed
) else (
    echo PHPUnit not found, skipping tests
)
echo.

REM ===================================================================
REM Step 3: Build Assets
REM ===================================================================
echo [3/8] Building production assets...

if exist "package.json" (
    call npm ci --production
    call npm run prod
    echo Assets built successfully
) else (
    echo No package.json found, skipping asset build
)
echo.

REM ===================================================================
REM Step 4: Install Dependencies
REM ===================================================================
echo [4/8] Installing production dependencies...

call composer install --no-dev --optimize-autoloader --no-interaction

echo Dependencies installed
echo.

REM ===================================================================
REM Step 5: Create Deployment Package
REM ===================================================================
echo [5/8] Creating deployment package...

set DEPLOY_DIR=deployment_%TIMESTAMP%
mkdir %DEPLOY_DIR%

REM Copy files (excluding unnecessary directories)
xcopy /E /I /Y /EXCLUDE:deploy-exclude.txt . %DEPLOY_DIR%

REM Copy environment file
copy /Y .env.%ENVIRONMENT% %DEPLOY_DIR%\.env

echo Deployment package created: %DEPLOY_DIR%
echo.

REM ===================================================================
REM Step 6: Upload to cPanel
REM ===================================================================
echo [6/8] Uploading to cPanel...
echo.
echo MANUAL STEP REQUIRED:
echo 1. Compress the %DEPLOY_DIR% folder to a ZIP file
echo 2. Upload the ZIP file to cPanel File Manager
echo 3. Extract the ZIP file in your public_html directory
echo 4. Press any key to continue after upload is complete...
pause > nul
echo.

REM ===================================================================
REM Step 7: Remote Optimization Commands
REM ===================================================================
echo [7/8] Remote optimization commands...
echo.
echo SSH into your cPanel and run these commands:
echo.
echo cd ~/public_html
echo chmod -R 755 storage bootstrap/cache
echo chmod 600 .env
echo php artisan migrate --force
echo php artisan cache:clear
echo php artisan config:cache
echo php artisan route:cache
echo php artisan view:cache
echo php artisan cache:warmup
echo php artisan db:optimize
echo.
echo Press any key after running the commands...
pause > nul
echo.

REM ===================================================================
REM Step 8: Verification
REM ===================================================================
echo [8/8] Deployment package ready for upload
echo.

echo ========================================================
echo         Deployment Package Created Successfully
echo ========================================================
echo.
echo Package Location: %DEPLOY_DIR%
echo.
echo Next Steps:
echo 1. Compress %DEPLOY_DIR% to ZIP
echo 2. Upload to cPanel File Manager
echo 3. Extract in public_html
echo 4. Run the optimization commands via SSH
echo 5. Verify at https://keohams.com
echo.
echo For automatic deployment, use WSL or Git Bash:
echo   bash deploy-cpanel.sh %ENVIRONMENT%
echo.

endlocal
