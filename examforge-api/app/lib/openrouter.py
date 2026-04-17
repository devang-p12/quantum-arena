import json
import httpx
from app.config import settings

# Structured schema we want the AI to return
JSON_SCHEMA = """
{
  "title": "String (e.g. Mid-term Examination)",
  "subject": "String (e.g. Computer Science)",
  "duration_minutes": 180,
  "total_marks": 100,
  "sections": [
    {
      "title": "String (e.g. Section A)",
      "instructions": "String instructions",
      "questions": [
        {
          "topic": "Specific Topic",
          "type": "Must be exactly one of: MCQ | Short Answer | Long Answer | True/False | Fill in Blanks | Numerical",
          "marks": number,
          "difficulty": "Must be exactly one of: Easy | Medium | Hard",
          "bloom": "Must be exactly one of: Remember | Understand | Apply | Analyze | Evaluate | Create"
        }
      ]
    }
  ]
}
"""

PROMPT_TEMPLATE = f"""
You are an expert academic curriculum designer. Your task is to parse the user's raw text (which may be a syllabus, a past exam paper, or a rough description of an exam) into a strict JSON blueprint representing the structure of the exam.

Do NOT actually write the full question texts yet unless they provide them. Just generate the "slots" based on the topics discussed.
If the text doesn't mention specific marks, duration, or titles, invent reasonable defaults for a standard university exam.
If the text is vague, distribute the marks evenly across topics mentioned to reach the total marks.

You MUST respond with VALID JSON exactly matching this schema:
{JSON_SCHEMA}

Raw Text to parse:
"""

async def parse_blueprint_to_json(raw_text: str) -> dict:
    if not settings.OPENROUTER_API_KEY:
        raise ValueError("OPENROUTER_API_KEY is not configured.")

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                "HTTP-Referer": "http://localhost:8081",
                "X-Title": "ExamForge API",
                "Content-Type": "application/json"
            },
            json={
                "model": "openai/gpt-4o-mini", # Fast, cheap, solid JSON standard
                "messages": [
                    {"role": "system", "content": "You are a JSON-only API. Print only valid JSON. No markdown backticks."},
                    {"role": "user", "content": PROMPT_TEMPLATE + "\n" + raw_text}
                ],
                "response_format": {"type": "json_object"}
            },
            timeout=45.0
        )
        response.raise_for_status()
        data = response.json()
        
        # Parse the JSON string from the response
        content = data["choices"][0]["message"]["content"]
        
        # Clean up any potential markdown formatting the AI might still wrap around it
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
            
        return json.loads(content.strip())
