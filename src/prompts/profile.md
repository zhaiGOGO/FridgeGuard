Task: Extract user preferences from the conversation and propose a memory patch.

Input:
{{input}}

Output JSON schema:
{
  "updates": [
    {
      "field": "favoriteCuisines",
      "op": "add",
      "value": "string",
      "confidence": 0.0,
      "rationale": "string",
      "source_text": "string"
    }
  ]
}

Rules:
- Do not update allergies unless user explicitly states it.
- Use low confidence if inference is weak.
