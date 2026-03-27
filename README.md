# Bodha AI

Bodha AI is a full-stack AI learning platform that helps students identify knowledge gaps, practice adaptive quizzes, and learn with a personalized tutor workflow.

It combines:

- A Flask backend for authentication, quiz analytics, recommendations, note-based testing, and dashboard metrics.
- A React + Vite frontend for interactive learning, AI-assisted quiz generation, reports, and chatbot support.

## Table of Contents

- [Key Features](#key-features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Run the Project](#run-the-project)
- [API Overview](#api-overview)
- [Scripts](#scripts)
- [Troubleshooting](#troubleshooting)
- [Roadmap Ideas](#roadmap-ideas)

## Key Features

- JWT-based authentication (email/password and Google login support).
- AI-guided quizzes:
  - Primary topic tests.
  - Sub-topic focused assessments.
  - Note-based MCQ generation and test sessions.
- Knowledge-gap analysis and weak-area recommendations.
- AI summary after quiz attempts with weakness-focused resources.
- Personalized dashboard with activity tracking and report history.
- Draggable in-app AI tutor chat with fullscreen support.

## Architecture

### Backend (Flask)

- App factory pattern with Blueprints under /api/\*.
- SQLAlchemy models for users, topics, quizzes, notes, chat/test sessions, and activity logs.
- ML services for gap analysis and recommendation ranking.
- AI content service for note-grounded tutoring and quiz/test feedback.

### Frontend (React + Vite)

- Route-based shell with authentication and dashboard modules.
- Modular content panels for Home, Topics, Quiz, Library, Tutorials, Reports, and About.
- API client layer in src/api/client.ts.
- Local report persistence and user-scoped learning history.

## Tech Stack

### Backend

- Flask
- Flask-SQLAlchemy
- Flask-Migrate
- Flask-JWT-Extended
- Flask-CORS
- scikit-learn, pandas, numpy
- PostgreSQL (default configuration)

### Frontend

- React 19
- Vite
- React Router
- Lucide React + React Icons
- Hugging Face Inference SDK
- Recharts
- html2pdf.js

## Project Structure

```text
Hackathon/
  Backend/
    app/
      routes/
      services/
      models.py
    migrations/
    config.py
    run.py
    requirements.txt
  Frontend/
    src/
      api/
      components/
      pages/
      utils/
    package.json
    vite.config.js
  .gitignore
  README.md
```

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm 9+
- PostgreSQL (recommended for production-like local setup)

## Environment Variables

Create local .env files in Backend and Frontend.

Important: in Vite env files, always use KEY=value format.

### Backend .env (Backend/.env)

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/knowledge_tutor
SECRET_KEY=replace_with_secure_secret
JWT_SECRET_KEY=replace_with_secure_jwt_secret
HUGGINGFACE_API_KEY=your_hf_token
HUGGINGFACE_MODEL=google/flan-t5-large
GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

### Frontend .env (Frontend/.env)

```env
VITE_API_BASE_URL=http://127.0.0.1:5000
VITE_HUGGINGFACE_API_KEY=your_hf_token
VITE_HF_QUIZ_MODEL=meta-llama/Meta-Llama-3-8B-Instruct
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
VITE_YOUTUBE_API_KEY=your_youtube_api_key
```

## Run the Project

Open two terminals from the project root.

### 1) Start Backend

```bash
cd Backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
# source .venv/bin/activate
pip install -r requirements.txt
python run.py
```

Backend default URL: http://127.0.0.1:5000

### 2) Start Frontend

```bash
cd Frontend
npm install
npm run dev
```

Frontend default URL: http://127.0.0.1:5173

## API Overview

Base URL: /api

### Auth

- POST /auth/register
- POST /auth/login
- POST /auth/google-login

### Quiz and Learning

- GET /quiz/topics
- POST /quiz/submit
- POST /library/notes
- GET /library/notes
- POST /library/notes/:note_id/generate-mcq
- POST /chatbot/message
- POST /chatbot/test/start
- POST /chatbot/test/answer

### Recommendation and Analytics

- POST /recommend/analyze
- GET /recommend/gaps
- GET /dashboard/activity
- POST /dashboard/heartbeat
- GET /dashboard/quiz-pie

## Scripts

### Frontend

- npm run dev: Start Vite development server.
- npm run build: Build production bundle.
- npm run preview: Preview built app.
- npm run lint: Run ESLint.

### Backend

- python run.py: Start Flask app (debug mode in current setup).

## Troubleshooting

- Frontend cannot reach backend:
  - Verify VITE_API_BASE_URL matches backend host/port.
- Google login fails:
  - Ensure GOOGLE_CLIENT_ID and VITE_GOOGLE_CLIENT_ID are set and aligned.
- AI features not responding:
  - Confirm HUGGINGFACE_API_KEY and VITE_HUGGINGFACE_API_KEY are valid.
- CORS/session issues:
  - Run frontend and backend on expected local hosts and ports.

## Roadmap Ideas

- Add role-based admin dashboard for mentor/teacher analytics.
- Add test coverage for key route flows and recommendation logic.
- Add CI pipeline for lint/build/test checks.
- Add Dockerized local development workflow.

---

If you are cloning this repository for the first time, start with the Environment Variables and Run the Project sections above.
