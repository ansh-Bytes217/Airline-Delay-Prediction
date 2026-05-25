# 1. Discard dynamic prediction logs to ensure a clean tree
if (Test-Path "backend/prediction_log.jsonl") {
    git checkout -- backend/prediction_log.jsonl
}

# 2. Stop tracking pycache files
git rm --cached -r backend/__pycache__ 2>$null
git rm --cached -r __pycache__ 2>$null

# 3. Soft reset back to the very first commit
git reset --soft 5a5c313345fbde501d6ec5c6741ad55e1b802b64
git reset

# 4. Commit .gitignore
git add .gitignore
git commit -m "chore: add root .gitignore to exclude build and python cache artifacts"

# 5. Commit LICENSE
git add LICENSE 2>$null
git commit -m "chore: add project open-source license configurations"

# 6. Commit Spring Boot Configuration and Models
git add springboot-backend/pom.xml springboot-backend/src/main/resources/application.properties springboot-backend/src/main/java/com/skypredict/backend/BackendApplication.java springboot-backend/src/main/java/com/skypredict/backend/config/WebConfig.java
if (Test-Path "springboot-backend/src/main/java/com/skypredict/backend/model/") {
    Get-ChildItem -Path "springboot-backend/src/main/java/com/skypredict/backend/model/" -Recurse | ForEach-Object { git add $_.FullName }
}
git commit -m "feat(backend): initialize Spring Boot application settings and DTO models"

# 7. Commit Spring Boot Services
if (Test-Path "springboot-backend/src/main/java/com/skypredict/backend/service/") {
    Get-ChildItem -Path "springboot-backend/src/main/java/com/skypredict/backend/service/" -Recurse | ForEach-Object { git add $_.FullName }
}
git commit -m "feat(backend): implement Flight, Weather, and Prediction service layer"

# 8. Commit Spring Boot Controllers
if (Test-Path "springboot-backend/src/main/java/com/skypredict/backend/controller/") {
    Get-ChildItem -Path "springboot-backend/src/main/java/com/skypredict/backend/controller/" -Recurse | ForEach-Object { git add $_.FullName }
}
git commit -m "feat(backend): expose REST endpoints in FlightController gateway"

# 9. Commit ML Training & Models
git add train_models.py best_model.pkl xgb_model.pkl cat_model.pkl keras_model.h5 feature_mappings.pkl
git commit -m "feat(ml): train and serialize Deep Learning & Stacking Ensemble models"

# 10. Commit Python Sidecar code
git add backend/main.py backend/model_monitor.py backend/requirements.txt
git commit -m "feat(ml): refactor FastAPI sidecar for predictions, logging, and MLOps drift monitoring"

# 11. Commit RAG Pipeline
git add backend/rag_pipeline.py
git commit -m "feat(rag): implement hybrid FAISS/BM25 retrieval and reranking pipeline"

# 12. Commit 3D WebGL Radar
git add frontend/src/pages/RadarPage.jsx frontend/src/pages/AnalyticsPage.jsx
git commit -m "feat(frontend): render holographic 3D Flight Radar Globe using Three.js WebGL"

# 13. Commit Frontend Auth & State components
git add frontend/src/components/NotificationBell.jsx frontend/src/components/PredictionHistory.jsx frontend/src/components/WeatherWidget.jsx frontend/src/contexts/AuthContext.jsx frontend/src/services/notificationService.js frontend/src/pages/AuthPage.jsx frontend/src/pages/LandingPage.jsx frontend/vite.config.js
git commit -m "feat(frontend): integrate UI notification widgets, AuthContext, and Firestore services"

# 14. Commit Multi-Container Deployment configurations
git add vercel.json docker-compose.yml backend/Dockerfile springboot-backend/Dockerfile run_dev.ps1 frontend/src/config.js
git commit -m "refactor(deploy): configure Docker services and vercel.json multi-service routing"

# 15. Commit Documentation
git add README.md frontend/index.html
git commit -m "docs: update system architecture and cloud deployment instructions in README.md"

# 16. Commit Unit Tests & scripts
if (Test-Path "springboot-backend/src/test/") {
    Get-ChildItem -Path "springboot-backend/src/test/" -Recurse | ForEach-Object { git add $_.FullName }
}
git add scratch/
git commit -m "test: add unit test suites and integration verification scripts"

# 17. Commit remaining files
git add .
git commit -m "chore: clean up remaining files and build configuration adjustments"

Write-Host "✅ History successfully rewritten locally!" -ForegroundColor Green
Write-Host "👉 Run the following command to update GitHub:" -ForegroundColor Yellow
Write-Host "   git push origin main --force" -ForegroundColor Yellow
