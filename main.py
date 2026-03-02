from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware # 1. IMPORT THIS
from pydantic import BaseModel
from engine import generate_tags 

app = FastAPI(
    title="Tag & Trail Categorization API",
    description="Accepts text and returns smart, diversified tags."
)

# 2. ADD THE SECURITY BYPASS (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, you'd put your frontend's real URL here. "*" means allow everything for local testing.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TagRequest(BaseModel):
    title: str
    text: str

class TagResponse(BaseModel):
    tags: list[str]

@app.post("/api/generate-tags", response_model=TagResponse)
async def get_tags(request: TagRequest):
    try:
        if not request.title and not request.text:
            return {"tags": []}
            
        final_tags = generate_tags(request.title, request.text)
        return {"tags": final_tags}
        
    except Exception as e:
        print(f"Server Error: {e}")
        raise HTTPException(status_code=500, detail="Internal Engine Error")