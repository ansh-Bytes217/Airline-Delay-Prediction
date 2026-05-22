Write-Host "🚀 Starting SkyPredict local development stack..." -ForegroundColor Cyan

# 1. Start Python ML Sidecar on port 8090
Write-Host "🤖 Starting Python ML Sidecar in a new window..." -ForegroundColor Yellow
Start-Process -FilePath "cmd.exe" -ArgumentList "/c title SkyPredict ML Sidecar && uvicorn backend.main:app --host 127.0.0.1 --port 8090"

# 2. Start Spring Boot Backend on port 8080
Write-Host "☕ Starting Spring Boot Backend in a new window..." -ForegroundColor Yellow
Start-Process -FilePath "cmd.exe" -ArgumentList "/c title SkyPredict Spring Boot Gateway && cd springboot-backend && mvnw.cmd spring-boot:run"

# 3. Start React Frontend on port 5173
Write-Host "⚛️ Starting React Frontend in a new window..." -ForegroundColor Yellow
Start-Process -FilePath "cmd.exe" -ArgumentList "/c title SkyPredict Frontend && cd frontend && npm run dev"

Write-Host "✅ Services launched! Wait a few seconds for startup, then visit:" -ForegroundColor Green
Write-Host "   Frontend: http://localhost:5173" -ForegroundColor Green
Write-Host "   Spring Boot API Gateway: http://localhost:8080" -ForegroundColor Green
Write-Host "   Python ML Sidecar: http://localhost:8090" -ForegroundColor Green
