# FLEXI Parking — Backend Server (Node.js & Express)

This folder contains the complete Node.js backend server with MongoDB / Mongoose integration.

## Files
- `server.js` — Express server, REST endpoints, password hashing, MongoDB schemas and auto-seeders.
- `.env` — Environment configuration (`PORT=5000`, `MONGODB_URI=mongodb://127.0.0.1:27017/flexi_parking`).
- `public/` — Static assets and fallback web views.
- `package.json` — Express, Mongoose, Cors, Dotenv dependencies.

## Commands
```powershell
npm start       # Starts Node server at http://localhost:5000
npm run dev     # Starts with nodemon for auto-reload
```
