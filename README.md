# CalcSight

A mobile-first calculator that looks like a normal calculator while supporting typed equations, screenshot/photo OCR, and one-frame camera scanning without showing an in-app camera preview.

## Features
- Standard arithmetic
- Parentheses and powers
- Square roots
- Trigonometric functions
- Logarithms
- Symbolic single-variable equations
- Screenshot/photo OCR with Tesseract.js
- Rear-camera capture that stops immediately after scanning

## Run
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

Camera access requires HTTPS or localhost. Browsers and phone operating systems may still show their normal camera permission/use indicators.
