# FLEXI Parking System — CA3

A full-stack parking management and authentication system, split into dedicated **`client`** (React frontend) and **`server`** (Node.js/Express backend) directories.

---

## Folder Structure

```
25070521333_Flexi_CA3/
├── client/                     # Frontend Application (React.js + Vite)
│   ├── dist/                   # Production build files
│   ├── node_modules/           # React dependencies
│   ├── src/                    # Source code (main.jsx, styles.css)
│   ├── index.html              # Frontend entry point
│   ├── package.json            # React & Vite dependencies
│   └── vite.config.js          # Vite config & API proxy
│
├── server/                     # Backend Application (Node.js + Express)
│   ├── node_modules/           # Express & Mongoose dependencies
│   ├── public/                 # Static fallback assets
│   ├── .env                    # Environment variables (PORT, MONGODB_URI)
│   ├── .env.example            # Example configuration
│   ├── package.json            # Server dependencies & scripts
│   └── server.js               # Express API, Auth, MongoDB Models & Seeders
│
├── package.json                # Root scripts to orchestrate client & server
└── README.md                   # Project documentation
```

---

## Live Links & MongoDB Compass

- **Web Dashboard**: [http://localhost:5000](http://localhost:5000)
- **Login Page**: [http://localhost:5000/login](http://localhost:5000/login)
- **Register Page**: [http://localhost:5000/register](http://localhost:5000/register)
- **MongoDB Compass Connection**:
  - Connection String: `mongodb://127.0.0.1:27017`
  - Database: `flexi_parking`
  - Collections: `users` and `slots`

---

## Quick Start Commands

### Option 1: Run From Root (Single Command)
Run the backend server (which also serves the compiled React client on port 5000):
```powershell
npm start
```

### Option 2: Run Separately (Independent Client & Server)

1. **Start Backend Server**:
   ```powershell
   cd server
   npm start
   ```
   *Runs backend REST API on `http://localhost:5000`*

2. **Start Frontend Dev Server**:
   ```powershell
   cd client
   npm run dev
   ```
   *Runs Vite Hot-Reload dev server on `http://localhost:5173`*

---

## Demo Test Accounts

| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@flexipark.com` | `admin123` |
| **User** | `alex@flexipark.com` | `user123` |

*You can also create any new account on `/register` — it will write directly into MongoDB Compass under collection `users`.*
