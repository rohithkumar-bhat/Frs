import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from extract_data import run_extraction

# Directory configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

# Global cache
cached_data = []
last_sync_time = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager to handle background tasks."""
    global cached_data, last_sync_time
    print("Startup: Running initial data extraction...")
    try:
        cached_data = run_extraction()
        last_sync_time = os.path.getmtime(os.path.join(STATIC_DIR, "data.js")) if os.path.exists(os.path.join(STATIC_DIR, "data.js")) else None
    except Exception as e:
        print(f"Startup extraction failed: {e}")
    
    # Start periodic background task
    task = asyncio.create_task(periodic_refresh())
    yield
    task.cancel()

async def periodic_refresh():
    """Background task to refresh data from Google Sheets every 60 seconds."""
    global cached_data
    while True:
        try:
            await asyncio.sleep(60)
            print("Background Task: Refreshing data...")
            newData = run_extraction()
            if newData:
                cached_data = newData
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"Background refresh failed: {e}")
            await asyncio.sleep(10)

app = FastAPI(title="EL FRS Attendance Dashboard", lifespan=lifespan)

@app.get("/api/data")
async def get_attendance_data(force: bool = False):
    """Endpoint to return the latest extracted data."""
    global cached_data
    try:
        if force or not cached_data:
            cached_data = run_extraction()
        return cached_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.get("/")
async def read_index():
    """Serve the main dashboard page."""
    index_path = os.path.join(STATIC_DIR, "index.html")
    if not os.path.exists(index_path):
        raise HTTPException(status_code=404, detail="index.html not found")
    return FileResponse(index_path)

# Mount static files
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

if __name__ == "__main__":
    import uvicorn
    # Use 0.0.0.0 to allow external access within the network
    uvicorn.run("app:app", host="0.0.0.0", port=8006, reload=True)
