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

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager to handle background tasks."""
    # Run extraction on startup
    print("Startup: Running initial data extraction...")
    try:
        run_extraction()
    except Exception as e:
        print(f"Startup extraction failed: {e}")
    
    # Start periodic background task (every 5 minutes)
    task = asyncio.create_task(periodic_refresh())
    yield
    # Cleanup
    task.cancel()

async def periodic_refresh():
    """Background task to refresh data from Google Sheets every 5 minutes."""
    while True:
        try:
            await asyncio.sleep(60)  # Wait 1 minute
            print("Background Task: Refreshing data from Google Sheets...")
            run_extraction()
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"Background refresh failed: {e}")
            await asyncio.sleep(60)  # Wait a minute before retrying on failure

app = FastAPI(title="EL FRS Attendance Dashboard", lifespan=lifespan)

@app.get("/api/data")
async def get_attendance_data():
    """Endpoint to return the latest extracted data."""
    data = run_extraction()
    if data is None:
        raise HTTPException(status_code=500, detail="Failed to fetch data from Google Sheets")
    return data

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
