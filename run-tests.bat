@echo off
REM Test Runner Batch Script for Windows
REM Usage: run-tests.bat [unit|feature|integration|coverage]

echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║         Laravel Test Suite Runner                      ║
echo ╚════════════════════════════════════════════════════════╝
echo.

if "%1"=="unit" (
    echo → Running Unit Tests...
    echo.
    php artisan test --testsuite=Unit
    goto end
)

if "%1"=="feature" (
    echo → Running Feature Tests...
    echo.
    php artisan test --testsuite=Feature
    goto end
)

if "%1"=="integration" (
    echo → Running Integration Tests...
    echo.
    vendor\bin\phpunit tests\Feature\Integration
    goto end
)

if "%1"=="coverage" (
    echo → Running All Tests with Coverage...
    echo.
    vendor\bin\phpunit --coverage-html coverage-report --coverage-text
    echo.
    echo → Coverage report generated in: coverage-report\index.html
    goto end
)

REM Default: Run all tests
echo → Running All Tests...
echo.
php artisan test

:end
echo.
if %ERRORLEVEL% EQU 0 (
    echo ✓ Tests completed successfully!
) else (
    echo ✗ Tests failed with error code: %ERRORLEVEL%
)
echo.
