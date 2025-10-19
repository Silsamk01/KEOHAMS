@echo off
REM Enhanced KYC System - Installation Script
REM Run this from the backend directory

echo ================================
echo Enhanced KYC System Installation
echo ================================
echo.

REM Install required npm packages
echo [1/4] Installing npm dependencies...
call npm install tesseract.js @vladmandic/face-api canvas

echo.
echo [2/4] Creating necessary directories...
if not exist "uploads\kyc" mkdir uploads\kyc
if not exist "models\face-api" mkdir models\face-api

echo.
echo [3/4] Running database migration...
call npm run migrate

echo.
echo [4/4] Installation complete!
echo.
echo ================================
echo IMPORTANT NEXT STEPS:
echo ================================
echo.
echo 1. Download face-api.js models:
echo    Visit: https://github.com/vladmandic/face-api/tree/master/model
echo    Download these models to backend/models/face-api/:
echo    - ssdMobilenetv1
echo    - faceLandmark68Net  
echo    - faceRecognitionNet
echo    - faceExpressionNet
echo.
echo 2. Add to your .env file:
echo    KYC_ENCRYPTION_KEY=your-very-long-secret-encryption-key-here
echo.
echo 3. Test the system:
echo    - Start server: npm run dev
echo    - Navigate to: http://localhost:4000/kyc-enhanced.html
echo.
echo ================================
pause
