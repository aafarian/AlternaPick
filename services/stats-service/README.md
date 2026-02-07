# Sports Tower - Stats Service

NBA player stats microservice powered by [FastAPI](https://fastapi.tiangolo.com/) and [nba_api](https://github.com/swar/nba_api).

This service runs as a separate process from the main Next.js application and provides live NBA game data and player box scores via REST endpoints.

## Prerequisites

- Python 3.10 or higher
- pip (Python package manager)

## Setup

1. Navigate to this directory:

   ```bash
   cd services/stats-service
   ```

2. Create and activate a virtual environment:

   ```bash
   python -m venv venv
   source venv/bin/activate  # macOS/Linux
   # or
   venv\Scripts\activate     # Windows
   ```

3. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

4. Copy the example environment file and configure:

   ```bash
   cp .env.example .env
   ```

## Running the Service

Start the development server:

```bash
uvicorn main:app --reload --port 8000
```

The service will be available at `http://localhost:8000`.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check - returns `{"status": "ok"}` |

Additional endpoints for live NBA stats will be added in a future update.

## Rate Limiting

This service interacts with NBA.com via the nba_api library. NBA.com enforces rate limits, so requests are throttled with a 2-3 second delay between calls. Do not reduce this interval or the service may get blocked.

## Architecture

```
Next.js App (port 3000)
    |
    | REST calls
    v
Stats Service (port 8000)
    |
    | nba_api (rate-limited)
    v
NBA.com
```
