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
                    "bloom": "Must be exactly one of: Remember | Understand | Apply | Analyze | Evaluate | Create",
                    "requires_chart": "boolean - true if this topic naturally needs plotting/graph/chart interpretation",
                    "chart_type": "null or one of: line | bar | scatter | pie",
                    "chart_mode": "null or one of: student_plot | analyze_graph"
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
For STEM/data-heavy topics (Math, Physics, Chemistry, Economics, etc.), set requires_chart=true where graph/chart plotting or interpretation is suitable and choose chart_type.
When requires_chart=true, set chart_mode:
- student_plot: student must plot graph from provided/generated values.
- analyze_graph: system will provide generated graph and student answers by interpreting it.

You MUST respond with VALID JSON exactly matching this schema:
{JSON_SCHEMA}

Raw Text to parse:
"""


def _exam_type_instruction(exam_type: str | None) -> str:
    if not exam_type:
        return ""

    normalized = exam_type.strip().lower()
    if normalized == "theoretical":
        return (
            "\nExam format preference: Theoretical paper. "
            "Prioritize Short Answer and Long Answer slots. Keep MCQ slots minimal."
        )
    if normalized == "mcq":
        return (
            "\nExam format preference: MCQ paper. "
            "Use mostly MCQ slots with objective-style topic coverage."
        )
    if normalized == "viva":
        return (
            "\nExam format preference: Viva. "
            "Create oral-prompt style slots, emphasizing conceptual understanding and application."
        )
    if normalized == "internal assessment":
        return (
            "\nExam format preference: Internal Assessment. "
            "Create a compact mixed blueprint suitable for shorter in-term evaluation."
        )
    return f"\nExam format preference: {exam_type.strip()}."


async def parse_blueprint_to_json(raw_text: str, exam_type: str | None = None) -> dict:
    if not settings.OPENROUTER_API_KEY:
        raise ValueError("OPENROUTER_API_KEY is not configured.")

    instruction = _exam_type_instruction(exam_type)
    prompt = PROMPT_TEMPLATE + instruction + "\n" + raw_text

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                "HTTP-Referer": "http://localhost:8081",
                "X-Title": "ExamForge API",
                "Content-Type": "application/json",
            },
            json={
                "model": "openai/gpt-4o-mini",  # Fast, cheap, solid JSON standard
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a JSON-only API. Print only valid JSON. No markdown backticks.",
                    },
                    {"role": "user", "content": prompt},
                ],
                "response_format": {"type": "json_object"},
            },
            timeout=45.0,
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
