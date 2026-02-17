#!/bin/bash

# Start development environment for trash cleanup app
# This script starts the database, backend, and frontend services

set -e

echo "🗑️  Starting Trash Cleanup Development Environment"
echo ""

# Check if database is running
echo "📊 Checking database..."
if ! docker ps | grep -q trash_cleanup_db; then
  echo "Starting database..."
  docker-compose up -d
  echo "Waiting for database to be healthy..."
  sleep 5
else
  echo "✓ Database already running"
fi

# Start backend in background
echo ""
echo "🔧 Starting backend server..."
cd backend
DATABASE_URL=postgresql://trash:trash@localhost:5433/trash_cleanup PORT=4000 npm run dev &
BACKEND_PID=$!
cd ..

# Give backend time to start
sleep 2

# Start frontend in background
echo ""
echo "🎨 Starting frontend server..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ Development environment started!"
echo ""
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:4000"
echo "  Database: localhost:5433"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for either process to exit
wait $BACKEND_PID $FRONTEND_PID
