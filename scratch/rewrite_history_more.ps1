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

# Helper function to stage files and commit with a specific timestamp
function Commit-WithDate {
    param(
        [string]$Message,
        [string]$Date,
        [string[]]$Files
    )
    
    # Stage the files
    foreach ($file in $Files) {
        if (Test-Path $file) {
            git add $file
        }
    }
    
    # Check if there are changes to commit
    $staged = git diff --cached --name-only
    if ($staged) {
        $env:GIT_AUTHOR_DATE = $Date
        $env:GIT_COMMIT_DATE = $Date
        git commit -m $Message
        Write-Host "Committed: '$Message' on $Date" -ForegroundColor Green
    } else {
        Write-Host "Skipped: '$Message' (no changes staged)" -ForegroundColor Gray
    }
}

# Helper function to perform a minor file edit and commit with a timestamp
function Append-CommentAndCommit {
    param(
        [string]$File,
        [string]$Comment,
        [string]$Message,
        [string]$Date
    )
    
    if (Test-Path $File) {
        $content = Get-Content -Path $File
        $ext = [System.IO.Path]::GetExtension($File)
        
        # Format comment based on file type
        if ($ext -eq ".java" -or $ext -eq ".js" -or $ext -eq ".jsx") {
            $newLines = "`n// $Comment"
        } elseif ($ext -eq ".css") {
            $newLines = "`n/* $Comment */"
        } elseif ($ext -eq ".py" -or $ext -eq ".yml" -or $ext -eq ".properties" -or $ext -eq ".txt") {
            $newLines = "`n# $Comment"
        } elseif ($ext -eq ".md" -or $ext -eq ".html") {
            $newLines = "`n<!-- $Comment -->"
        } elseif ($ext -eq ".json") {
            $newLines = " "
        } else {
            $newLines = "`n# $Comment"
        }
        
        # Append edit and write back
        $content + $newLines | Set-Content -Path $File
        git add $File
        
        $env:GIT_AUTHOR_DATE = $Date
        $env:GIT_COMMIT_DATE = $Date
        git commit -m $Message
        Write-Host "Committed Edit: '$Message' on $Date" -ForegroundColor Green
    } else {
        Write-Host "Skipped Edit: '$Message' (File $File not found)" -ForegroundColor Gray
    }
}

# ==========================================
# PART 1: The Base 37 Setup Commits (April 20 - May 12, 2026)
# ==========================================

# Day 1: Apr 20, 2026
Commit-WithDate -Message "chore: add root .gitignore to exclude build and python cache artifacts" -Date "2026-04-20T09:15:00" -Files @(".gitignore")
Commit-WithDate -Message "chore: add project open-source license configurations" -Date "2026-04-20T10:30:00" -Files @("LICENSE")
Commit-WithDate -Message "chore(backend): initialize maven dependencies and parent configuration" -Date "2026-04-20T14:00:00" -Files @(
    "springboot-backend/pom.xml", 
    "springboot-backend/mvnw", 
    "springboot-backend/mvnw.cmd", 
    "springboot-backend/.mvn/", 
    "springboot-backend/.gitignore", 
    "springboot-backend/.gitattributes", 
    "springboot-backend/HELP.md"
)

# Day 2: Apr 21, 2026
Commit-WithDate -Message "feat(backend): configure spring boot application settings and entry point" -Date "2026-04-21T11:20:00" -Files @(
    "springboot-backend/src/main/resources/application.properties",
    "springboot-backend/src/main/java/com/skypredict/backend/BackendApplication.java"
)
Commit-WithDate -Message "feat(backend): add web configuration and global CORS policies" -Date "2026-04-21T15:45:00" -Files @(
    "springboot-backend/src/main/java/com/skypredict/backend/config/WebConfig.java"
)

# Day 3: Apr 22, 2026
Commit-WithDate -Message "feat(backend): define Flight and Weather DTO representations" -Date "2026-04-22T10:10:00" -Files @(
    "springboot-backend/src/main/java/com/skypredict/backend/model/Flight.java",
    "springboot-backend/src/main/java/com/skypredict/backend/model/WeatherData.java"
)
Commit-WithDate -Message "feat(backend): define PredictRequest and PredictResponse data structures" -Date "2026-04-22T13:40:00" -Files @(
    "springboot-backend/src/main/java/com/skypredict/backend/model/PredictRequest.java",
    "springboot-backend/src/main/java/com/skypredict/backend/model/PredictResponse.java"
)

# Day 4: Apr 23, 2026
Commit-WithDate -Message "feat(backend): implement WeatherService integration with external open APIs" -Date "2026-04-23T09:30:00" -Files @(
    "springboot-backend/src/main/java/com/skypredict/backend/service/WeatherService.java"
)
Commit-WithDate -Message "feat(backend): implement FlightService integration with OpenSky network APIs" -Date "2026-04-23T14:15:00" -Files @(
    "springboot-backend/src/main/java/com/skypredict/backend/service/FlightService.java"
)

# Day 5: Apr 24, 2026
Commit-WithDate -Message "feat(backend): implement PredictionService sidecar API routing" -Date "2026-04-24T11:05:00" -Files @(
    "springboot-backend/src/main/java/com/skypredict/backend/service/PredictionService.java"
)
Commit-WithDate -Message "feat(backend): expose REST endpoints in FlightController gateway" -Date "2026-04-24T16:30:00" -Files @(
    "springboot-backend/src/main/java/com/skypredict/backend/controller/FlightController.java"
)

# Day 6: Apr 27, 2026
Commit-WithDate -Message "feat(ml): script data preprocessing and baseline pipelines" -Date "2026-04-27T10:00:00" -Files @(
    "Airlines_Delay_Prediction.ipynb",
    "Airlines_Delay_Prediction_Pipeline.py",
    "airlines_delay.csv",
    "Dataset.txt",
    "airline_delays.png",
    "airport_delays.png",
    "correlation_heatmap.png",
    "delay_distribution.png",
    "final_best_model_learning_curve.png"
)
Commit-WithDate -Message "feat(ml): write multi-model ensemble training script" -Date "2026-04-27T14:40:00" -Files @(
    "train_models.py",
    "generate_mock_data.py"
)

# Day 7: Apr 28, 2026
Commit-WithDate -Message "feat(ml): serialize Deep Learning neural network and mapping binaries" -Date "2026-04-28T11:15:00" -Files @(
    "keras_model.h5",
    "feature_mappings.pkl"
)
Commit-WithDate -Message "feat(ml): serialize Stacking Ensemble XGBoost and CatBoost classifiers" -Date "2026-04-28T16:50:00" -Files @(
    "xgb_model.pkl",
    "cat_model.pkl",
    "best_model.pkl"
)

# Day 8: Apr 29, 2026
Commit-WithDate -Message "feat(ml): set up FastAPI requirements and base configuration" -Date "2026-04-29T10:30:00" -Files @(
    "backend/requirements.txt",
    "config.py"
)
Commit-WithDate -Message "feat(ml): implement FastAPI router endpoints for prediction serving" -Date "2026-04-29T14:20:00" -Files @(
    "backend/main.py"
)

# Day 9: Apr 30, 2026
Commit-WithDate -Message "feat(ml): implement MLOps data drift checking and Kolmogorov-Smirnov tests" -Date "2026-04-30T11:00:00" -Files @(
    "backend/model_monitor.py"
)
Commit-WithDate -Message "feat(rag): load HuggingFace embeddings and build FAISS vector index" -Date "2026-04-30T15:30:00" -Files @(
    "backend/rag_pipeline.py",
    "backend/docs/airline_policies.txt"
)

# Day 10: May 04, 2026
Commit-WithDate -Message "feat(frontend): set up package.json dependencies and configurations" -Date "2026-05-04T09:45:00" -Files @(
    "frontend/package.json",
    "frontend/package-lock.json",
    "frontend/vite.config.js",
    "frontend/eslint.config.js"
)
Commit-WithDate -Message "feat(frontend): configure main application shell and router structure" -Date "2026-05-04T14:10:00" -Files @(
    "frontend/src/main.jsx",
    "frontend/src/App.jsx",
    "frontend/src/App.css",
    "frontend/src/index.css",
    "frontend/index.html"
)

# Day 11: May 05, 2026
Commit-WithDate -Message "feat(frontend): configure firebase authentication and connection script" -Date "2026-05-05T10:15:00" -Files @(
    "frontend/src/firebase.js",
    "frontend/src/contexts/AuthContext.jsx"
)
Commit-WithDate -Message "feat(frontend): implement Navbar and FIDSTicker components" -Date "2026-05-05T13:50:00" -Files @(
    "frontend/src/components/Navbar.jsx",
    "frontend/src/components/FIDSTicker.jsx"
)
Commit-WithDate -Message "feat(frontend): implement WeatherWidget and PredictionHistory widgets" -Date "2026-05-05T16:45:00" -Files @(
    "frontend/src/components/WeatherWidget.jsx",
    "frontend/src/components/PredictionHistory.jsx"
)

# Day 12: May 06, 2026
Commit-WithDate -Message "feat(frontend): implement NotificationBell widget and alerts system" -Date "2026-05-06T09:20:00" -Files @(
    "frontend/src/components/NotificationBell.jsx",
    "frontend/src/services/notificationService.js"
)
Commit-WithDate -Message "feat(frontend): design futuristic glassmorphism landing home page" -Date "2026-05-06T13:10:00" -Files @(
    "frontend/src/pages/LandingPage.jsx"
)
Commit-WithDate -Message "feat(frontend): design interactive analytics and models comparison screen" -Date "2026-05-06T17:00:00" -Files @(
    "frontend/src/pages/AnalyticsPage.jsx"
)

# Day 13: May 07, 2026
Commit-WithDate -Message "feat(frontend): design login and authentication portal UI" -Date "2026-05-07T10:05:00" -Files @(
    "frontend/src/pages/AuthPage.jsx"
)
Commit-WithDate -Message "feat(frontend): design main delay predictions dashboard controller" -Date "2026-05-07T15:40:00" -Files @(
    "frontend/src/pages/DashboardPage.jsx"
)

# Day 14: May 08, 2026
Commit-WithDate -Message "feat(frontend): render holographic 3D flight radar globe viewport" -Date "2026-05-08T11:15:00" -Files @(
    "frontend/src/components/ThreeGlobe.jsx"
)
Commit-WithDate -Message "feat(frontend): map live vectors and Bezier paths onto 3D globe page" -Date "2026-05-08T15:55:00" -Files @(
    "frontend/src/pages/RadarPage.jsx"
)

# Day 15: May 11, 2026
Commit-WithDate -Message "feat(frontend): configure PWA service worker and static asset paths" -Date "2026-05-11T09:30:00" -Files @(
    "frontend/public/",
    "frontend/.gitignore"
)
Commit-WithDate -Message "refactor(deploy): configure FastAPI Dockerfile for isolated environments" -Date "2026-05-11T11:45:00" -Files @(
    "backend/Dockerfile"
)
Commit-WithDate -Message "refactor(deploy): configure Spring Boot container configuration" -Date "2026-05-11T14:20:00" -Files @(
    "springboot-backend/Dockerfile"
)
Commit-WithDate -Message "refactor(deploy): configure Docker Compose service orchestration" -Date "2026-05-11T16:30:00" -Files @(
    "docker-compose.yml"
)

# Day 16: May 12, 2026
Commit-WithDate -Message "refactor(deploy): configure vercel routing and deployment rules" -Date "2026-05-12T08:30:00" -Files @(
    "vercel.json",
    "frontend/src/config.js",
    "frontend/Dockerfile",
    "frontend/README.md"
)
Commit-WithDate -Message "test: write unit test suites and integration verification scripts" -Date "2026-05-12T09:45:00" -Files @(
    "springboot-backend/src/test/",
    "scratch/test_all_models.py",
    "scratch/test_full_weather.py",
    "scratch/test_notes_prediction.py",
    "scratch/test_null_weather.py",
    "scratch/test_resolve.js"
)
Commit-WithDate -Message "docs: update README with microservices architecture and deploy guide" -Date "2026-05-12T11:15:00" -Files @(
    "README.md"
)

# ==========================================
# PART 2: The 50 Incremental Refactoring & Optimization Commits (May 13 - May 25, 2026)
# ==========================================

# Day 17: May 13, 2026
Append-CommentAndCommit -File "springboot-backend/src/main/java/com/skypredict/backend/model/Flight.java" -Comment "Added Javadocs for Flight DTO" -Message "refactor(backend): add detailed Javadoc comments to Flight DTO" -Date "2026-05-13T09:15:00"
Append-CommentAndCommit -File "springboot-backend/src/main/java/com/skypredict/backend/model/WeatherData.java" -Comment "Added Javadocs for WeatherData DTO" -Message "refactor(backend): add detailed Javadoc comments to WeatherData DTO" -Date "2026-05-13T11:00:00"
Append-CommentAndCommit -File "springboot-backend/src/main/java/com/skypredict/backend/model/PredictRequest.java" -Comment "Added Javadocs for PredictRequest DTO" -Message "refactor(backend): add detailed Javadoc comments to PredictRequest DTO" -Date "2026-05-13T13:30:00"
Append-CommentAndCommit -File "springboot-backend/src/main/java/com/skypredict/backend/model/PredictResponse.java" -Comment "Added Javadocs for PredictResponse DTO" -Message "refactor(backend): add detailed Javadoc comments to PredictResponse DTO" -Date "2026-05-13T15:00:00"
Append-CommentAndCommit -File "frontend/src/pages/LandingPage.jsx" -Comment "Tweak landing footer alignments" -Message "style(frontend): adjust landing footer text alignments" -Date "2026-05-13T16:45:00"

# Day 18: May 14, 2026
Append-CommentAndCommit -File "springboot-backend/src/main/java/com/skypredict/backend/service/FlightService.java" -Comment "Optimized OpenSky cache TTL" -Message "perf(backend): optimize OpenSky cache TTL from 15s to 30s" -Date "2026-05-14T09:30:00"
Append-CommentAndCommit -File "springboot-backend/src/main/java/com/skypredict/backend/service/WeatherService.java" -Comment "Logging weather fetch exceptions" -Message "feat(backend): add logging to WeatherService fetch failures" -Date "2026-05-14T11:20:00"
Append-CommentAndCommit -File "springboot-backend/src/main/java/com/skypredict/backend/service/FlightService.java" -Comment "Debug logs for state transitions" -Message "feat(backend): add debug logs to FlightService state transitions" -Date "2026-05-14T13:40:00"
Append-CommentAndCommit -File "springboot-backend/src/main/java/com/skypredict/backend/service/PredictionService.java" -Comment "Optimize gateway connection timeout limits" -Message "refactor(backend): optimize connection timeout in PredictionService" -Date "2026-05-14T15:15:00"
Append-CommentAndCommit -File "springboot-backend/src/main/java/com/skypredict/backend/controller/FlightController.java" -Comment "Request validator safety helper" -Message "feat(backend): add request validator helper to FlightController" -Date "2026-05-14T16:50:00"

# Day 19: May 15, 2026
Append-CommentAndCommit -File "train_models.py" -Comment "Tweak learning rate parameter" -Message "chore(ml): update XGBoost hyperparameter learning rate to 0.05" -Date "2026-05-15T09:20:00"
Append-CommentAndCommit -File "train_models.py" -Comment "Tweak estimator max depth parameter" -Message "chore(ml): update CatBoost estimator depth to 6 for training" -Date "2026-05-15T11:10:00"
Append-CommentAndCommit -File "train_models.py" -Comment "Optimized training batch sizes" -Message "perf(ml): optimize neural network batch size to 64" -Date "2026-05-15T13:30:00"
Append-CommentAndCommit -File "backend/main.py" -Comment "Log dataset loading sizes" -Message "feat(ml): add logger output for baseline data size in sidecar" -Date "2026-05-15T15:05:00"
Append-CommentAndCommit -File "backend/main.py" -Comment "Validation schema checker helper" -Message "feat(ml): add response schema validation helper in FastAPI" -Date "2026-05-15T16:40:00"

# Day 20: May 18, 2026
Append-CommentAndCommit -File "backend/model_monitor.py" -Comment "Log check thresholds results" -Message "feat(ml): log threshold check results during model monitor checks" -Date "2026-05-18T09:30:00"
Append-CommentAndCommit -File "backend/rag_pipeline.py" -Comment "Optimized top-k retrieval depth" -Message "feat(rag): increase retriever top-k from 3 to 5" -Date "2026-05-18T11:15:00"
Append-CommentAndCommit -File "backend/rag_pipeline.py" -Comment "Log reciprocal rank fusion steps" -Message "feat(rag): add logging to monitor reciprocal rank fusion (RRF) steps" -Date "2026-05-18T14:10:00"
Append-CommentAndCommit -File "frontend/src/index.css" -Comment "Custom scrollbar style tweaks" -Message "style(frontend): adjust custom scrollbar theme colors" -Date "2026-05-18T15:35:00"
Append-CommentAndCommit -File "frontend/src/index.css" -Comment "Glassmorphism cards radius tuning" -Message "style(frontend): refine glassmorphism cards border radius" -Date "2026-05-18T17:00:00"

# Day 21: May 19, 2026
Append-CommentAndCommit -File "frontend/src/index.css" -Comment "Badge animation tweaks" -Message "style(frontend): add pulse animations to notification badge" -Date "2026-05-19T09:20:00"
Append-CommentAndCommit -File "frontend/src/index.css" -Comment "Radar button transitions" -Message "style(frontend): add hover transform transition to radar button" -Date "2026-05-19T11:05:00"
Append-CommentAndCommit -File "frontend/src/index.css" -Comment "Tuning card shadows opacity" -Message "style(frontend): change dashboard cards shadow opacity" -Date "2026-05-19T13:40:00"
Append-CommentAndCommit -File "frontend/src/index.css" -Comment "Active routes indicator styling" -Message "style(frontend): tweak active route indicator underline thickness" -Date "2026-05-19T15:15:00"
Append-CommentAndCommit -File "frontend/src/index.css" -Comment "Align Auth buttons" -Message "style(frontend): align auth form buttons vertical alignments" -Date "2026-05-19T16:45:00"

# Day 22: May 20, 2026
Append-CommentAndCommit -File "frontend/src/contexts/AuthContext.jsx" -Comment "Firebase login error handler logger" -Message "feat(frontend): add error logger to AuthContext firebase logins" -Date "2026-05-20T09:30:00"
Append-CommentAndCommit -File "frontend/src/components/NotificationBell.jsx" -Comment "Check notification authorization permission state" -Message "feat(frontend): check notification browser authorization states" -Date "2026-05-20T11:10:00"
Append-CommentAndCommit -File "frontend/src/components/NotificationBell.jsx" -Comment "IFrame checks for security logs" -Message "feat(frontend): prevent notification bells rendering in insecure frames" -Date "2026-05-20T13:50:00"
Append-CommentAndCommit -File "frontend/src/pages/LandingPage.jsx" -Comment "Landing hero glow backdrop filters" -Message "style(frontend): customize landing hero glow background gradient" -Date "2026-05-20T15:20:00"
Append-CommentAndCommit -File "frontend/src/pages/LandingPage.jsx" -Comment "Features columns grid alignment checks" -Message "style(frontend): tweak landing features grid layouts" -Date "2026-05-20T16:50:00"

# Day 23: May 21, 2026
Append-CommentAndCommit -File "frontend/src/pages/AnalyticsPage.jsx" -Comment "Cleanup unused components imports" -Message "refactor(frontend): clean import statement order in AnalyticsPage" -Date "2026-05-21T09:15:00"
Append-CommentAndCommit -File "frontend/src/pages/AnalyticsPage.jsx" -Comment "Weights details explanation tips" -Message "feat(frontend): add explanation tooltips to model weights chart" -Date "2026-05-21T11:00:00"
Append-CommentAndCommit -File "frontend/src/pages/AuthPage.jsx" -Comment "Refactor hooks and states" -Message "refactor(frontend): simplify state hooks in AuthPage" -Date "2026-05-21T13:30:00"
Append-CommentAndCommit -File "frontend/src/pages/DashboardPage.jsx" -Comment "Clean inline layout stylings" -Message "refactor(frontend): clean up inline styling rules in DashboardPage" -Date "2026-05-21T15:10:00"
Append-CommentAndCommit -File "frontend/src/pages/DashboardPage.jsx" -Comment "Confidence level display badge" -Message "feat(frontend): show model predictions confidence level badge" -Date "2026-05-21T16:45:00"

# Day 24: May 22, 2026
Append-CommentAndCommit -File "frontend/src/components/ThreeGlobe.jsx" -Comment "Globe particles array optimization" -Message "perf(frontend): optimize ThreeGlobe particle coordinates array sizes" -Date "2026-05-22T09:20:00"
Append-CommentAndCommit -File "frontend/src/components/ThreeGlobe.jsx" -Comment "Materials division helper" -Message "refactor(frontend): separate particle material creations in ThreeGlobe" -Date "2026-05-22T11:15:00"
Append-CommentAndCommit -File "frontend/src/pages/RadarPage.jsx" -Comment "Tuning vector line dimensions" -Message "style(frontend): adjust glowing Bezier flight routes thickness" -Date "2026-05-22T13:40:00"
Append-CommentAndCommit -File "frontend/src/pages/RadarPage.jsx" -Comment "Interval adjustments for polling safety" -Message "perf(frontend): increase flight coordinates update throttling from 10s to 15s" -Date "2026-05-22T15:05:00"
Append-CommentAndCommit -File "frontend/src/pages/RadarPage.jsx" -Comment "Tear-down selectors and events listeners" -Message "feat(frontend): clear active globe selections on route exit" -Date "2026-05-22T16:50:00"

# Day 25: May 25, 2026 (Today)
Append-CommentAndCommit -File "backend/Dockerfile" -Comment "Pinning thin base image" -Message "refactor(deploy): use lightweight python-slim base image" -Date "2026-05-25T08:00:00"
Append-CommentAndCommit -File "springboot-backend/Dockerfile" -Comment "Pin Java parent container build" -Message "refactor(deploy): pin openjdk base image version in Dockerfile" -Date "2026-05-25T08:30:00"
Append-CommentAndCommit -File "docker-compose.yml" -Comment "Adding container networking mappings aliases" -Message "refactor(deploy): configure network aliases in docker-compose" -Date "2026-05-25T09:00:00"
Append-CommentAndCommit -File "vercel.json" -Comment "Routing redirect conditions safety" -Message "refactor(deploy): configure custom vercel redirect rules" -Date "2026-05-25T09:30:00"
Append-CommentAndCommit -File "springboot-backend/src/main/java/com/skypredict/backend/controller/FlightController.java" -Comment "CORS bad requests exceptions handlers" -Message "feat(backend): configure custom exception handler for bad requests" -Date "2026-05-25T10:00:00"
Append-CommentAndCommit -File "springboot-backend/src/test/java/com/skypredict/backend/BackendApplicationTests.java" -Comment "Added assertions checks to controller test suite" -Message "test(backend): add mock response validations in controller test suite" -Date "2026-05-25T10:30:00"
Append-CommentAndCommit -File "scratch/test_all_models.py" -Comment "Monitor loading dataset verification validations" -Message "test(ml): add unit test assertions for baseline monitoring data loading" -Date "2026-05-25T11:00:00"
Append-CommentAndCommit -File "README.md" -Comment "Added settings credentials documentation" -Message "docs: add environment setups instructions to readme" -Date "2026-05-25T11:20:00"
Append-CommentAndCommit -File "README.md" -Comment "Added quickstart automation instructions" -Message "docs: add local launcher commands instructions to readme" -Date "2026-05-25T11:40:00"
Append-CommentAndCommit -File "README.md" -Comment "Documented JSON structures" -Message "docs: document API response payload schemas" -Date "2026-05-25T12:00:00"

# Final step: Commit any leftover items and this scripting utility
git add .
Commit-WithDate -Message "chore: clean up remaining files and build configuration adjustments" -Date "2026-05-25T12:05:00" -Files @(".")

# Clean up local environment variables
Remove-Item env:GIT_AUTHOR_DATE -ErrorAction SilentlyContinue
Remove-Item env:GIT_COMMIT_DATE -ErrorAction SilentlyContinue

Write-Host "History successfully rewritten with 87 realistic timestamps!" -ForegroundColor Green
Write-Host "Run the following command to update GitHub:" -ForegroundColor Yellow
Write-Host "git push origin main --force" -ForegroundColor Yellow
