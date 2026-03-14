# EchoBook 📖
**"Living Memory, One Story at a Time"**

EchoBook is a creative storyteller agent that conducts warm, emotionally intelligent voice interviews with elderly people—and generates a fully illustrated, narrated life story book in real-time as they speak. 

Every story becomes a page. Every memory becomes an illustrated scene. The book builds itself simultaneously alongside the conversation.

*Built for the "Creative Storyteller" Hackathon track.*

## 🌟 The Problem
53 million Americans provide unpaid care for a family member with dementia or age-related cognitive decline. Reminiscence therapy is clinically proven to reduce anxiety and maintain identity, but creating physical "life story books" is prohibitively time-consuming and expensive. 

Families want to preserve their loved ones' stories, but the interview and transcription process is emotionally draining and intimidating.

## 🚀 The Solution
EchoBook replaces the barrier of manual transcription and illustration with an empathetic AI experience:
1. **Emotionally Intelligent Agent:** Powered by Gemini Live API, the agent listens, paces itself for elderly speakers, and asks poignant follow-up questions.
2. **Real-Time Generation:** As a memory is spoken, our pipeline extracts the vignette, prompts Imagen (or Pollinations API), and visually inserts the memory into a living book.
3. **Session Continuity:** Books are persisted in Firestore. The agent remembers past sessions and guides the storyteller through an ongoing journey.

## ⚙️ How We Built It
- **Frontend**: Lightweight HTML/JS/CSS served via FastAPI. Fully responsive, featuring animated audio visualizers and smooth interleaving UI.
- **Backend API**: Python FastAPI application coordinating real-time WebSockets, LLM prompting, and database ops.
- **Voice Intelligence**: **Gemini Live API (`gemini-2.5-flash-native-audio-latest`)** for streaming audio-to-audio empathic interviews.
- **Data Structuring**: Gemini Flash prompt extracts `{scene, era, emotion, people}` JSON blobs from the conversation context.
- **Illustration**: Used standard **Pollinations API** for the illustrations to adapt aesthetic vibes (watercolor, nostalgic) dynamically.
- **Database**: **Google Cloud Firestore** to store books across separate sessions continuously. 

## 🏃‍♂️ How to Run the App (Locally)

### Requirements
- Python 3.12+
- Gemini API Key ([Get it here](https://aistudio.google.com/apikey))
- Google Cloud Project with Firestore enabled (for session saving)

### 1. Set Up Environment
Copy `.env.example` to `.env` and fill in your keys:
```bash
cp .env.example .env
```
Ensure you provide a valid `GEMINI_API_KEY` and the path to your GCP `service-account.json`.

### 2. Install Dependencies
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Start the Server
```bash
python3 -m uvicorn main:app --host 0.0.0.0 --port 8080
```

Open `http://localhost:8080/` in your browser.

## ☁️ Deployment (Google Cloud Run)
We have included a `Dockerfile` for single-step deployment to Google Cloud Run.

```bash
gcloud builds submit --tag gcr.io/[YOUR_PROJECT_ID]/echobook
gcloud run deploy echobook --image gcr.io/[YOUR_PROJECT_ID]/echobook --platform managed --allow-unauthenticated
```
*Note: Ensure your Cloud Run service is granted the appropriate Firestore datastore permissions.*

---
*Created over 48 hours. Let's make sure no memory is ever lost.*
