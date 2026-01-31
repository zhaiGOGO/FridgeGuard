Task: Generate multiple recipe options using expiring items.

Input:
{{input}}

Output JSON schema:
{
  "recipes": [
    {
      "title": "string",
      "steps": ["string"],
      "usedItems": ["string"],
      "missingItems": ["string"],
      "servings": 2,
      "cookTimeMinutes": 20
    }
  ],
  "need_clarification": false,
  "clarification_questions": []
}

Rules:
- Prioritize yellow/red items.
- Respect dietary restrictions and allergies from memory.
- Avoid suggesting items not in pantry unless listed in missingItems.
- Provide 3 distinct options when possible.
