export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const question = typeof request.body?.question === 'string'
    ? request.body.question.trim().slice(0, 1400)
    : '';

  if (!question) {
    return response.status(400).json({ error: 'Missing question' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return response.status(503).json({ error: 'AI question mode is not configured yet' });
  }

  try {
    const apiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5.6-luna',
        store: false,
        instructions: 'Answer the user question directly and accurately. Return only the short answer, with no preamble. Keep it brief enough to fit on a calculator display when possible. If the question needs a short explanation, use at most two concise sentences.',
        input: question,
        max_output_tokens: 160,
      }),
    });

    const data = await apiResponse.json();

    if (!apiResponse.ok) {
      const message = data?.error?.message || 'AI service request failed';
      return response.status(apiResponse.status).json({ error: message });
    }

    const answer = (data.output || [])
      .flatMap((item) => item?.content || [])
      .filter((item) => item?.type === 'output_text')
      .map((item) => item.text)
      .join('\n')
      .trim();

    if (!answer) {
      return response.status(502).json({ error: 'No answer returned' });
    }

    return response.status(200).json({ answer });
  } catch (error) {
    return response.status(500).json({ error: error?.message || 'Could not reach AI service' });
  }
}
