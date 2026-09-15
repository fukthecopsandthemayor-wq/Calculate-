# CalcSight

A mobile-first calculator with two separate scanning systems: a local math solver and an optional AI question scanner.

## Features
- Standard arithmetic
- Parentheses and powers
- Square roots
- Trigonometric functions
- Logarithms
- Symbolic single-variable equations
- Screenshot/photo OCR with Tesseract.js
- Math Scan: rear-camera capture + local OCR/math solving with no AI required
- AI Question Scan: a separate `?` camera button for ordinary non-math questions
- AI answers appear in the normal calculator result area

## Run
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

## AI Question Scan backend
The math features remain browser-only. AI Question Scan calls `/api/answer`, which must run on a serverless-capable host such as Vercel.

The endpoint supports either:
- Vercel AI Gateway using `AI_GATEWAY_API_KEY` or Vercel's `VERCEL_OIDC_TOKEN`
- Direct OpenAI using `OPENAI_API_KEY`

Never put an AI provider key in browser-side Vite environment variables.

GitHub Pages can continue hosting the math-only static build, but GitHub Pages cannot execute the `/api/answer` server function by itself.

Camera access requires HTTPS or localhost. Browsers and phone operating systems may still show their normal camera permission/use indicators.
