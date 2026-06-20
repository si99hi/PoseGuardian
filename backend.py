from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

# Allow React (on port 5173) to talk to Python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PoseData(BaseModel):
    exercise: str
    left_angle: float
    right_angle: float

@app.post("/analyze")
async def analyze_pose(data: PoseData):
    warning = "✅ Form looks good!"
    
    if data.exercise == "squat":
        if data.left_angle < 90 or data.right_angle < 90:
            warning = f"⚠️ STOP! Knee too deep ({min(data.left_angle, data.right_angle):.1f}°)."
    
    elif data.exercise == "curl":
        if data.left_angle < 30 or data.right_angle < 30:
            warning = f"💪 Full contraction! Elbow at {min(data.left_angle, data.right_angle):.1f}°."
        elif data.left_angle > 150 or data.right_angle > 150:
            warning = "⬇️ Lower the weight slowly. Too wide."
    
    elif data.exercise == "shoulder_press":
        if data.left_angle < 90 or data.right_angle < 90:
            warning = f"🚨 Don't drop weights! Elbow too low."

    return {"warning": warning}