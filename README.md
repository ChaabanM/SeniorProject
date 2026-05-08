# Hospital Inventory DSS Dashboard

A comprehensive inventory and supply chain management system with real-time dashboards, risk analysis, and vendor management.

## 🏗️ Project Structure

```
dashboard/
├── backend/                    # Flask backend (Google Sheets ingestor)
│   ├── app.py                 # Main Flask application
│   ├── config.py              # Configuration management
│   ├── requirements.txt        # Python dependencies
│   ├── .env                   # Environment variables
│   ├── service-account.json   # Google service account (local only)
│   ├── service-account.example.json
│   └── README.md              # Backend documentation
│
├── web/                        # Next.js frontend
│   ├── src/
│   │   ├── app/               # Next.js app router
│   │   ├── components/        # React components
│   │   ├── lib/               # Utilities and libraries
│   │   └── middleware.ts      # Authentication middleware
│   ├── package.json
│   ├── seed-auth.js           # Database seeding script
│   └── README.md
│
├── database/                   # Database schemas and seeds
│   ├── schemas/
│   │   ├── postgres/          # PostgreSQL schemas
│   │   ├── sqlite/            # SQLite schemas
│   │   └── migrations/        # Schema migrations
│   ├── seeds/                 # Database files
│   └── README.md
│
├── scripts/                    # Development scripts
│   ├── dev/                   # Development utilities
│   ├── etl/                   # ETL and data loading
│   ├── tools/                 # Maintenance tools
│   └── README.md
│
└── CLEANUP_REPORT.md          # Project cleanup details
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+ - [Download](https://nodejs.org)
- **Python** 3.8+ - [Download](https://www.python.org)
- **SQLite3** - Usually pre-installed on macOS/Linux
- **Git** - For version control

### System-Specific Setup

#### macOS

```bash
# Install Homebrew dependencies
brew install node python3 sqlite3

# Verify installations
node --version
python3 --version
sqlite3 --version
```

#### Windows

1. Install Node.js from https://nodejs.org (includes npm)
2. Install Python from https://www.python.org (check "Add Python to PATH")
3. Install SQLite from https://www.sqlite.org/download.html or use `choco install sqlite`
4. Verify in Command Prompt:
   ```cmd
   node --version
   python --version
   sqlite3 --version
   ```

#### Linux (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install -y nodejs npm python3 python3-venv sqlite3

# Verify installations
node --version
python3 --version
sqlite3 --version
```

### 1. Clone/Navigate to Project

```bash
# Navigate to project directory
cd dashboard

# Initialize project (if first time)
git init  # optional if not already a git repo
```

### 2. Frontend Setup

```bash
# Navigate to web directory
cd web

# Install dependencies
npm install

# Run seed script to populate test users
node seed-auth.js

# Start development server
npm run dev
# The frontend will be available at http://localhost:3000
# (or next available port if 3000 is in use)
```

### 3. Backend Setup (in a new terminal)

If you need a Google service account file, copy `backend/service-account.example.json` to `backend/service-account.json` and fill in your own credentials before starting the backend.

```bash
# Navigate to backend directory
cd backend

# Create Python virtual environment
python3 -m venv .venv

# Activate virtual environment
# macOS/Linux:
source .venv/bin/activate
# Windows (Command Prompt):
.venv\Scripts\activate
# Windows (PowerShell):
.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Start Flask server
python app.py
# The backend will be available at http://127.0.0.1:5055
```

### ✅ Verify Everything is Running

- **Frontend**: Open browser to [http://localhost:3000](http://localhost:3000)
- **Backend**: Check [http://127.0.0.1:5055/health](http://127.0.0.1:5055/health)

## 🔐 Authentication & Role-Based Access Control

### Test Credentials

| Email                           | Password       | Role                     | Module Access                                        |
| ------------------------------- | -------------- | ------------------------ | ---------------------------------------------------- |
| `inventory.manager@gmail.com`   | `ChangeMe123!` | INVENTORY_MANAGER        | Inventory Management, Warehouse Management, Forecast |
| `procurement.manager@gmail.com` | `ChangeMe123!` | PROCUREMENT_RISK_MANAGER | Risk Management, Vendor Management, Forecast         |

### Authentication Flow

1. User logs in with email and password
2. Credentials validated against SQLite database (`web/auth.db`)
3. Session token generated (JWT, 12-hour expiration)
4. Token stored as HTTP-only cookie (`dss_session`)
5. Middleware enforces role-based access to modules
6. Unauthorized access redirects to `/access-denied`

### Role-Based Access Control (RBAC)

**INVENTORY_MANAGER** has access to:

- 📦 **Inventory Management** - Item tracking, ABC Analysis, EOQ Calculator
- 🏭 **Warehouse Management** - Space utilization, Labor productivity
- ⚠️ **Risk Management** - Risk Heat Map, Supply Chain Risk Register
- 🏪 **Vendor Management** - Supplier KPI Dashboard, Score Calculator
- 📊 **Forecast** - Shared access with other roles

**PROCUREMENT_RISK_MANAGER** has access to:

- ⚠️ **Risk Management** - Risk Heat Map, Supply Chain Risk Register
- 🏪 **Vendor Management** - Supplier KPI Dashboard, Score Calculator


### Seed/Reset Test Users

```bash
cd web

# Reset authentication database and seed default users
node seed-auth.js

# This creates the two test accounts above
```

### Change Password

Users can change their password after logging in through the profile settings (if implemented).

## 📊 Features & Modules

### 📦 Inventory Management

- Real-time inventory tracking with stock levels
- **ABC Analysis** - Classify items by importance
- **EOQ Calculator** - Economic Order Quantity optimization
- **Reorder Point** - Automatic reorder level calculations
- **Safety Stock** - Buffer stock recommendations

### 📊 Forecast Module (Shared Access)

- Multiple demand forecasting algorithms
- Historical trend analysis
- Seasonal adjustment
- Forecast accuracy metrics

### ⚠️ Risk Management

- **Risk Heat Map** - Visualize supplier and supply chain risks
- **Supply Chain Risk Register** - Track identified risks
- **Disruption Impact Assessment** - Model impact scenarios
- **Mitigation Action Plan Tracker** - Monitor risk responses

### 🏪 Vendor Management

- **Supplier KPI Dashboard** - Performance metrics overview
- **Supplier Score Calculator** - Quantitative vendor evaluation
- KPI trending and alerts
- Vendor comparison tools

### 🏭 Warehouse Management

- **Space Utilization** - Optimize storage efficiency
- **Labor Productivity** - Track labor metrics
- **Capacity Expansion** - Plan for growth
- Location and bin management

### Key Capabilities

- ✅ Real-time inventory tracking
- ✅ Automated data sync from Google Sheets
- ✅ Role-based access control (RBAC)
- ✅ Multi-tenant data isolation
- ✅ Responsive design for desktop and mobile
- ✅ REST API for programmatic access
- ✅ Data export to PDF and Excel formats

## 🔌 API Endpoints

### Frontend API (`web/src/app/api/`)

- `/auth/login` - User authentication
- `/auth/logout` - User logout
- `/auth/me` - Current user info
- `/dashboard` - Dashboard data
- `/filters` - Available filter values
- `/inventory/*` - Inventory module endpoints
- `/forecast` - Forecast data
- `/risk/*` - Risk analysis endpoints
- `/vendor/*` - Vendor KPIs

### Backend API (Flask, `http://localhost:5055/`)

- `GET /health` - Service health check
- `GET /status` - Sync status and statistics
- `POST /sync-now` - Trigger manual sync

## 🗄️ Database

### SQLite (Default)

- Demo: `database/seeds/dss_inventory_demo.db`
- Production: `database/seeds/dss_inventory.db`

### PostgreSQL (Alternative)

- Schema available in `database/schemas/postgres/`
- Use `dss_schema_postgres.sql` for setup

## 🛠️ Development

### Running Both Services Simultaneously

#### macOS/Linux (Recommended: Use Terminal Tabs)

```bash
# Terminal Tab 1: Frontend
cd dashboard/web
npm run dev

# Terminal Tab 2: Backend
cd dashboard/backend
source .venv/bin/activate
python app.py
```

#### macOS (Optional: Use tmux for split panes)

```bash
# Install tmux if needed
brew install tmux

# Create new tmux session with both services
tmux new-session -d -s dashboard -x 200 -y 50

# Split horizontally and run services
tmux send-keys -t dashboard "cd dashboard/web && npm run dev" Enter
tmux split-window -t dashboard -h
tmux send-keys -t dashboard "cd dashboard/backend && source .venv/bin/activate && python app.py" Enter

# Attach to session
tmux attach -t dashboard
```

#### Windows (Command Prompt: Use Multiple Windows)

```cmd
REM Window 1: Frontend
cd dashboard\web
npm run dev

REM Window 2: Backend (open new Command Prompt)
cd dashboard\backend
.venv\Scripts\activate
python app.py
```

#### Windows (PowerShell: Use Split Panes)

```powershell
# Split pane horizontally
# Use Ctrl+Shift+2 in Windows Terminal

# In top pane:
cd dashboard\web
npm run dev

# In bottom pane:
cd dashboard\backend
.venv\Scripts\Activate.ps1
python app.py
```

### Seed Test Data

#### All Platforms

```bash
# Seed authentication database with test users
cd web
node seed-auth.js

# Load warehouse data
cd ../scripts/dev
python load_warehouse_module_data.py

# Seed location events
python seed_item_location_events.py
```

#### Windows (if bash scripts fail)

```cmd
cd web
node seed-auth.js

cd ..\scripts\dev
python load_warehouse_module_data.py
python seed_item_location_events.py
```

### ETL Operations

#### macOS/Linux

```bash
cd scripts/etl
python etl_load_sqlite.py
```

#### Windows

```cmd
cd scripts\etl
python etl_load_sqlite.py
```

### Database Maintenance

#### macOS/Linux

```bash
cd scripts/tools
python fix_item_names.py
python delete_google_sheet_ingested_rows.py
```

#### Windows

```cmd
cd scripts\tools
python fix_item_names.py
python delete_google_sheet_ingested_rows.py
```

## 📁 File Organization

### Backend (`/backend`)

- **Application Files**: `app.py`, `config.py`
- **Services**: Google Sheets client, database writer
- **Utilities**: Data mapper, state management
- **Configuration**: `.env`, `service-account.json` (local only), `service-account.example.json`, `.env.example`

### Frontend (`/web`)

- **App**: Next.js app router with pages and API routes
- **Components**: Reusable React components
- **Lib**: Authentication, database utilities
- **Public**: Static assets

### Database (`/database`)

- **Schemas**: SQL files for Postgres and SQLite
- **Seeds**: Database files for development
- **Migrations**: Schema version control (planned)

### Scripts (`/scripts`)

- **Dev**: Development utilities and seeders
- **ETL**: Data loading and transformation
- **Tools**: Maintenance and admin scripts

## 🔧 Configuration

### Backend Environment Variables (.env)

#### Setup

1. Copy the example (if available):

   ```bash
   # macOS/Linux
   cp backend/.env.example backend/.env

   # Windows (Command Prompt)
   copy backend\.env.example backend\.env
   ```

2. Edit `backend/.env`:
   ```env
   GOOGLE_SHEET_ID=your_sheet_id
   GOOGLE_SHEET_RANGE=Sheet1!A:L
   GOOGLE_SERVICE_ACCOUNT_JSON=./service-account.json
   SQLITE_DB_PATH=../database/seeds/dss_inventory_demo.db
   STATE_FILE=./state.json
   POLL_INTERVAL_SECONDS=3
   ```

#### Database Path Notes

**macOS/Linux:**

- Absolute paths: `/Users/username/Downloads/dashboard/database/seeds/dss_inventory_demo.db`
- Relative paths work: `../database/seeds/dss_inventory_demo.db`

**Windows:**

- Absolute paths: `C:\Users\username\Downloads\dashboard\database\seeds\dss_inventory_demo.db`
- Relative paths work: `..\database\seeds\dss_inventory_demo.db`
- Use backslashes or escaped backslashes in paths

### Frontend Configuration

#### macOS/Linux

- Auth database: `web/auth.db` (auto-created on first run)
- Session cookie: `dss_session`
- Middleware: `web/src/middleware.ts` (enforces RBAC)

#### Windows

- Auth database: `web\auth.db` (auto-created on first run)
- Session cookie: `dss_session`
- Middleware: `web\src\middleware.ts` (enforces RBAC)

### Authentication Secret (Optional for Production)

#### macOS/Linux

```bash
# Set custom auth secret
export AUTH_SECRET="your-very-secure-random-string"

# Or add to .env file in web/ directory
echo "AUTH_SECRET=your-very-secure-random-string" >> web/.env.local
```

#### Windows (Command Prompt)

```cmd
REM Set custom auth secret
set AUTH_SECRET=your-very-secure-random-string

REM Or create web\.env.local
echo AUTH_SECRET=your-very-secure-random-string > web\.env.local
```

#### Windows (PowerShell)

```powershell
# Set custom auth secret
$env:AUTH_SECRET = "your-very-secure-random-string"

# Or create web\.env.local
"AUTH_SECRET=your-very-secure-random-string" | Out-File web\.env.local
```

## 📝 Documentation

- [Backend Setup](./backend/README.md)
- [Database Schemas](./database/README.md)
- [Development Scripts](./scripts/README.md)
- [Project Cleanup Details](./CLEANUP_REPORT.md)

## 🔄 Data Flow

```
Google Sheets
    ↓
Backend (Flask) → Sync Service
    ↓
SQLite Database
    ↓
Frontend APIs
    ↓
Web Dashboard (Next.js)
```

## 🚨 Troubleshooting

### Port Already in Use

#### macOS

```bash
# Find process using port 3000 (frontend)
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use the convenient one-liner
lsof -ti:3000 | xargs kill -9

# For backend port 5055
lsof -ti:5055 | xargs kill -9
```

#### Windows (Command Prompt)

```cmd
# Find process using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID with the actual ID)
taskkill /PID <PID> /F

# Or for port 5055
netstat -ano | findstr :5055
taskkill /PID <PID> /F
```

#### Windows (PowerShell)

```powershell
# Find and kill process on port 3000
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force

# For port 5055
Get-Process -Id (Get-NetTCPConnection -LocalPort 5055).OwningProcess | Stop-Process -Force
```

### Database Lock

#### macOS/Linux

```bash
# Remove SQLite lock files
cd web
rm -f auth.db-shm auth.db-wal

# Or for the main inventory database
cd ../database/seeds
rm -f dss_inventory_demo.db-shm dss_inventory_demo.db-wal
```

#### Windows (Command Prompt)

```cmd
cd web
del auth.db-shm auth.db-wal

REM For the main inventory database
cd ..\database\seeds
del dss_inventory_demo.db-shm dss_inventory_demo.db-wal
```

#### Windows (PowerShell)

```powershell
cd web
Remove-Item auth.db-shm, auth.db-wal -ErrorAction SilentlyContinue

# For the main inventory database
cd ..\database\seeds
Remove-Item dss_inventory_demo.db-shm, dss_inventory_demo.db-wal -ErrorAction SilentlyContinue
```

### Python Virtual Environment Issues

#### macOS/Linux

```bash
# Recreate venv from scratch
cd backend
rm -rf .venv
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Verify installation
python --version
pip list
```

#### Windows (Command Prompt)

```cmd
cd backend
rmdir /s /q .venv
python -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt

REM Verify installation
python --version
pip list
```

#### Windows (PowerShell)

```powershell
cd backend
Remove-Item .venv -Recurse -Force
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt

# Verify installation
python --version
pip list
```

### Node.js/npm Issues

#### macOS (Using Homebrew)

```bash
# Update npm
npm install -g npm@latest

# Clear npm cache
npm cache clean --force

# Reinstall dependencies
cd web
rm -rf node_modules package-lock.json
npm install
```

#### Windows (Command Prompt)

```cmd
REM Update npm
npm install -g npm@latest

REM Clear npm cache
npm cache clean --force

REM Reinstall dependencies
cd web
rmdir /s /q node_modules
del package-lock.json
npm install
```

#### Windows (PowerShell)

```powershell
# Update npm
npm install -g npm@latest

# Clear npm cache
npm cache clean --force

# Reinstall dependencies
cd web
Remove-Item node_modules -Recurse -Force
Remove-Item package-lock.json
npm install
```

### Permission Denied Errors

#### macOS/Linux

```bash
# Give execute permission to scripts
chmod +x backend/.venv/bin/python
chmod +x web/node_modules/.bin/*

# Or for all venv binaries
chmod -R +x backend/.venv/bin
```

#### Windows

- Windows doesn't use file permissions in the same way
- If you get permission errors, ensure:
  - You're running Command Prompt/PowerShell as Administrator
  - The project folder is not in a protected location (avoid Program Files)
  - Check antivirus software isn't blocking file access

### Frontend Not Compiling

#### All Platforms

```bash
cd web

# Clear Next.js cache
rm -rf .next
# Windows: rmdir /s /q .next

# Reinstall SWC dependencies (Next.js compiler)
npm install

# Try dev server again
npm run dev
```

### Backend Won't Start

#### macOS/Linux

```bash
# Check Python version
python3 --version  # Should be 3.8+

# Check if venv is activated (should see (.venv) in prompt)
source backend/.venv/bin/activate

# Check Flask installation
pip list | grep -i flask

# Run with debug output
python app.py --verbose
```

#### Windows (Command Prompt)

```cmd
REM Check Python version
python --version

REM Check if venv is activated (should see (.venv) in prompt)
backend\.venv\Scripts\activate

REM Check Flask installation
pip list | findstr /i flask

REM Run with debug output
python app.py --verbose
```

### CORS or API Connection Errors

1. **Verify both services are running:**
   - Frontend: [http://localhost:3000](http://localhost:3000)
   - Backend: [http://127.0.0.1:5055/health](http://127.0.0.1:5055/health)

2. **Check backend `.env` file:**

   ```bash
   cat backend/.env  # macOS/Linux
   type backend\.env  # Windows
   ```

3. **Verify Google Sheets access:**
   - Ensure `backend/service-account.json` exists locally
   - Verify the sheet ID matches `GOOGLE_SHEET_ID` in `.env`
   - Sheet must be shared with the service account email

## � Recommended Tools & Setup

### Code Editor

#### macOS

```bash
# Install VS Code via Homebrew
brew install --cask visual-studio-code

# Or download from https://code.visualstudio.com
```

**Recommended VS Code Extensions:**

- Python (Microsoft)
- Pylance (Microsoft)
- ES7+ React/Redux/React-Native snippets (dsznajder)
- TypeScript Vue Plugin (Vue)
- Tailwind CSS IntelliSense (Bradleys)
- SQLite (alexcvzz)
- REST Client (Huachao Mao)

#### Windows

- Download VS Code from https://code.visualstudio.com
- Run the installer
- Same extensions as macOS (search in Extensions marketplace)

### Database Browser

#### macOS

```bash
# Install DB Browser for SQLite
brew install --cask db-browser-for-sqlite

# Or download from https://sqlitebrowser.org
```

#### Windows

- Download from https://sqlitebrowser.org
- Run the installer
- Useful for viewing SQLite data directly

### Terminal Tools

#### macOS

- **Default Terminal** - Works well
- **iTerm2** - Enhanced terminal (optional)
  ```bash
  brew install --cask iterm2
  ```

#### Windows

- **Command Prompt** - Included with Windows
- **PowerShell** - Included with Windows (recommended)
- **Windows Terminal** - Modern terminal app
  ```powershell
  # Install via Microsoft Store or:
  winget install Microsoft.WindowsTerminal
  ```

### Git (Optional for version control)

#### macOS

```bash
# Install via Homebrew
brew install git

# Or download from https://git-scm.com
```

#### Windows

- Download from https://git-scm.com
- Run the installer
- Or install via `winget install Git.Git`

## 📋 Common Commands Reference

### Quick Start (One-time Setup)

#### macOS/Linux

```bash
# Clone/enter project
cd dashboard

# Frontend setup
cd web && npm install && node seed-auth.js && cd ..

# Backend setup
cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && cd ..

# Done! Now run services (see next section)
```

#### Windows (Command Prompt)

```cmd
cd dashboard

REM Frontend setup
cd web
npm install
node seed-auth.js
cd ..

REM Backend setup
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
cd ..

REM Done! Now run services (see next section)
```

### Daily Development Workflow

#### macOS/Linux

```bash
# Start in terminal Tab 1 (Frontend)
cd dashboard/web && npm run dev

# Start in terminal Tab 2 (Backend)
cd dashboard/backend && source .venv/bin/activate && python app.py

# Open browser
open http://localhost:3000
```

#### Windows

```cmd
REM Start in Command Prompt 1 (Frontend)
cd dashboard\web
npm run dev

REM Start in Command Prompt 2 (Backend)
cd dashboard\backend
.venv\Scripts\activate
python app.py

REM Open browser to http://localhost:3000
```

### Cleanup & Reset

#### macOS/Linux

```bash
# Stop servers (Ctrl+C in both terminals)

# Remove build artifacts
rm -rf web/.next web/node_modules backend/.venv

# Clear databases
rm -f web/auth.db web/auth.db-shm web/auth.db-wal

# Ready to reinstall
```

#### Windows (Command Prompt)

```cmd
REM Stop servers (Ctrl+C in both terminals)

REM Remove build artifacts
rmdir /s /q web\.next web\node_modules backend\.venv

REM Clear databases
del web\auth.db web\auth.db-shm web\auth.db-wal

REM Ready to reinstall
```

### Build for Production

#### All Platforms

```bash
# Frontend build
cd web
npm run build
npm start

# Backend runs same way (no build needed)
cd ../backend
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
python app.py
```

### Run Specific Modules

#### All Platforms

```bash
# Seed authentication database
cd web && node seed-auth.js && cd ..

# Load warehouse data
python scripts/dev/load_warehouse_module_data.py

# Run ETL
python scripts/etl/etl_load_sqlite.py

# Database maintenance
python scripts/tools/fix_item_names.py
```

### Frontend

- Next.js 16.1.6
- React 19.2.3
- TypeScript 5
- Tailwind CSS 4
- better-sqlite3 (local database)

### Backend

- Flask 3.1.3
- google-api-python-client 2.195.0
- google-auth 2.50.0
- python-dotenv 1.2.2

## 📄 License

Internal project - Hospital Inventory DSS Dashboard

## 👥 Support

For issues or questions, refer to the module-specific README files in each directory.

---

**Project Status**: ✅ Ready for Development
**Last Updated**: May 3, 2026
