AI-Powered Collaborative Notes Workspace

A full-stack, AI-integrated note-taking application built for the Peblo Developer Challenge. This app transforms raw notes into structured productivity hubs using High-Performance AI.

---
## ✨Key Features
* **Smart Summarization:** Uses Groq (Llama 3.3) to generate instant summaries of long notes.
* **Auto-Extracted Action Items:** Automatically detects tasks within notes and creates an interactive checklist.
* **Productivity Insights:** A dedicated dashboard showing note counts, tag frequency, and recent activity.
* **Secure Authentication:** Full JWT-based auth system for private note management.
* **Public Sharing:** Generate unique, shareable links for public read-only access.
* **Hybrid AI Logic:** Built-in graceful fallback system to ensure 100% uptime even during API rate limits.

---

## 🛠️Tech Stack
* **Frontend:** Next.js 16 (App Router), Tailwind CSS, Lucide Icons, Axios.
* **Backend:** Node.js, Express, JWT.
* **Database:** MongoDB (Mongoose).
* **AI Engine:** Groq LPU (Llama 3.3 70B) for sub-second inference.

## 🚀 Getting Started
### 1. Clone & Install
```bash
# Install Backend Dependencies
cd backend && npm install

# Install Frontend Dependencies
cd ../frontend && npm install
```


### 2. Configure Environment Variables
Create a .env file in the backend folder:
```bash
PORT=5000
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_secret_key
GROQ_API_KEY=your_groq_key
```


### 3. Run the App
Terminal 1 (Backend):
```bash
cd backend
node server.js
```
Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

## Engineering Highlights
Migration Logic: Implemented a backend migration script to seamlessly upgrade legacy note data formats.
Resilient AI: Built a "Hybrid" AI service that prioritizes live Groq inference with an automated mock fallback system.
Performance: Optimized for sub-second AI responses using Groq’s LPU architecture.
