@echo off
echo.
echo ====================
echo Testando Email
echo ====================
echo.

curl -X POST http://localhost:3001/api/test-email ^
  -H "Content-Type: application/json" ^
  -d "{\"bookingId\":\"c558bfc3-c1ce-4ea4-8e5c-41e2510ab7ae\"}"

echo.
echo ====================
