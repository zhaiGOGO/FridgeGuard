Task: Extract food items from the input and estimate expiry dates.

Input:
{{input}}

Output JSON schema:
{
  "items": [
    {
      "name": "string",
      "quantity": 1,
      "unit": "string",
      "expiryAt": "YYYY-MM-DD",
      "confidence": 0.0,
      "source": "receipt|fridge_photo|manual"
    }
  ],
  "need_clarification": false,
  "clarification_questions": []
}

Rules:
- If quantity or unit is unknown, guess conservatively and lower confidence.
- If expiry cannot be inferred, ask clarification.
- Use common-sense shelf life defaults by category.
