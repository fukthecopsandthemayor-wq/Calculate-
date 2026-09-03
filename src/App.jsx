import { useEffect, useRef, useState } from 'react';
import { evaluate, format } from 'mathjs';
import nerdamer from 'nerdamer/all.min';
import { createWorker } from 'tesseract.js';

const keys = [
  { label: 'AC', action: 'clear', tone: 'utility' },
  { label: '⌫', action: 'backspace', tone: 'utility' },
  { label: '( )', value: '()', tone: 'utility' },
  { label: '÷', value: '/', tone: 'operator' },
  { label: '7', value: '7' },
  { label: '8', value: '8' },
  { label: '9', value: '9' },
  { label: '×', value: '*', tone: 'operator' },
  { label: '4', value: '4' },
  { label: '5', value: '5' },
  { label: '6', value: '6' },
  { label: '−', value: '-', tone: 'operator' },
  { label: '1', value: '1' },
  { label: '2', value: '2' },
  { label: '3', value: '3' },
  { label: '+', value: '+', tone: 'operator' },
  { label: '0', value: '0', wide: true },
  { label: '.', value: '.' },
  { label: '=', action: 'solve', tone: 'operator' },
];

const scientificKeys = [
  { label: '√', value: 'sqrt(' },
  { label: 'x²', action: 'square' },
  { label: 'π', value: 'pi' },
  { label: '^', value: '^' },
  { label: 'sin', value: 'sin(' },
  { label: 'cos', value: 'cos(' },
  { label: 'tan', value: 'tan(' },
  { label: 'log', value: 'log10(' },
];

function normalizeExpression(input) {
  return input
    .trim()
    .replace(/[−–—]/g, '-')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/√\s*\(/g, 'sqrt(')
    .replace(/√\s*([0-9.]+)/g, 'sqrt($1)')
    .replace(/π/g, 'pi')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/,/g, '');
}

function prettyValue(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Result is not finite');
    return format(value, { precision: 14 });
  }
  if (value && typeof value.toString === 'function') return value.toString();
  return String(value);
}

function solveMath(raw) {
  const expression = normalizeExpression(raw);
  if (!expression) throw new Error('Enter a problem');

  if (expression.includes('=')) {
    const sides = expression.split('=');
    if (sides.length !== 2) throw new Error('Use one equals sign');

    const equationForVariables = nerdamer(`(${sides[0]})-(${sides[1]})`);
    const variables = equationForVariables.variables();
    if (variables.length) {
      const variable = variables[0];
      const solved = nerdamer.solveEquations(expression, variable);
      const values = Array.isArray(solved) ? solved : [solved];
      const cleaned = values
        .flatMap((item) => {
          if (Array.isArray(item) && item.length === 2) return [`${item[0]} = ${item[1]}`];
          return [`${variable} = ${String(item)}`];
        })
        .filter((item) => !item.endsWith('[]'));
      if (cleaned.length) return cleaned.join(', ');
    }

    const left = evaluate(sides[0]);
    const right = evaluate(sides[1]);
    return prettyValue(left) === prettyValue(right) ? 'true' : 'false';
  }

  try {
    return prettyValue(evaluate(expression));
  } catch (mathError) {
    try {
      const symbolic = nerdamer(expression).evaluate().text();
      if (symbolic) return symbolic;
    } catch {}
    throw mathError;
  }
}

function scoreMathLine(line) {
  const operators = (line.match(/[=+\-*/^×÷√]/g) || []).length;
  const digits = (line.match(/[0-9]/g) || []).length;
  const mathWords = (line.match(/\b(?:sin|cos|tan|log|sqrt)\b/gi) || []).length;
  return operators * 4 + digits + mathWords * 4;
}

function bestMathText(rawText) {
  const lines = rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return '';
  lines.sort((a, b) => scoreMathLine(b) - scoreMathLine(a));
  return lines[0].replace(/[|]/g, '1').replace(/\s+/g, '').replace(/[“”]/g, '');
}

export default function App() {
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState('0');
  const [status, setStatus] = useState('');
  const [scientific, setScientific] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const workerRef = useRef(null);

  useEffect(() => () => {
    workerRef.current?.terminate?.();
    videoRef.current?.srcObject?.getTracks?.().forEach((track) => track.stop());
  }, []);

  const append = (value) => {
    setStatus('');
    if (value === '()') {
      const opens = (expression.match(/\(/g) || []).length;
      const closes = (expression.match(/\)/g) || []).length;
      setExpression((current) => current + (opens > closes ? ')' : '('));
      return;
    }
    setExpression((current) => current + value);
  };

  const solveCurrent = (candidate = expression) => {
    try {
      const answer = solveMath(candidate);
      setResult(answer);
      setStatus('');
      return answer;
    } catch (error) {
      setResult('Error');
      setStatus(error?.message || 'Could not solve that problem');
      return null;
    }
  };

  const onKey = (key) => {
    if (key.action === 'clear') {
      setExpression(''); setResult('0'); setStatus(''); return;
    }
    if (key.action === 'backspace') {
      setExpression((current) => current.slice(0, -1)); setStatus(''); return;
    }
    if (key.action === 'solve') { solveCurrent(); return; }
    if (key.action === 'square') {
      setExpression((current) => (current ? `(${current})^2` : '')); return;
    }
    append(key.value);
  };

  const getWorker = async () => {
    if (workerRef.current) return workerRef.current;
    setStatus('Loading scanner…');
    workerRef.current = await createWorker('eng', 1, {
      logger: (message) => {
        if (message.status === 'recognizing text') {
          setStatus(`Scanning ${Math.round((message.progress || 0) * 100)}%`);
        }
      },
    });
    return workerRef.current;
  };

  const solveImage = async (image) => {
    setBusy(true);
    setStatus('Reading problem…');
    try {
      const worker = await getWorker();
      const { data } = await worker.recognize(image);
      const detected = bestMathText(data.text || '');
      if (!detected) throw new Error('No equation found');
      setExpression(detected);
      const answer = solveCurrent(detected);
      if (answer !== null) setStatus('');
    } catch (error) {
      setResult('Error');
      setStatus(error?.message || 'Could not read that problem');
    } finally {
      setBusy(false);
    }
  };

  const onImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (file) await solveImage(file);
    event.target.value = '';
  };

  const scanCamera = async () => {
    if (busy) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('Camera scanning is not supported in this browser');
      return;
    }

    setBusy(true);
    setStatus('Opening camera…');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });

      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();

      if (!video.videoWidth) {
        await new Promise((resolve) => {
          const finish = () => resolve();
          video.addEventListener('loadeddata', finish, { once: true });
          setTimeout(finish, 900);
        });
      }

      const sourceWidth = video.videoWidth || 1280;
      const sourceHeight = video.videoHeight || 720;
      const scale = Math.min(1, 1600 / sourceWidth);
      const canvas = canvasRef.current;
      canvas.width = Math.max(1, Math.round(sourceWidth * scale));
      canvas.height = Math.max(1, Math.round(sourceHeight * scale));
      canvas.getContext('2d', { willReadFrequently: true }).drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      stream.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
      if (!blob) throw new Error('Could not capture image');
      setBusy(false);
      await solveImage(blob);
    } catch (error) {
      stream?.getTracks?.().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
      setBusy(false);
      setResult('Error');
      setStatus(error?.name === 'NotAllowedError' ? 'Camera permission is required to scan' : (error?.message || 'Camera scan failed'));
    }
  };

  return (
    <main className="page">
      <section className="calculator" aria-label="Calculator">
        <div className="display">
          <div className="display-tools">
            <button className="mini-button" type="button" aria-label="Scan math problem with camera" title="Scan with camera" onClick={scanCamera} disabled={busy}>◉</button>
            <button className="mini-button" type="button" aria-label="Solve math problem from screenshot" title="Use screenshot" onClick={() => fileInputRef.current?.click()} disabled={busy}>▧</button>
            <button className={`mini-button ${scientific ? 'active' : ''}`} type="button" aria-label="Toggle scientific keys" title="Scientific keys" onClick={() => setScientific((current) => !current)}>ƒ</button>
          </div>

          <input
            className="expression-input"
            value={expression}
            onChange={(event) => { setExpression(event.target.value); setStatus(''); }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') solveCurrent();
              if (event.key === 'Escape') { setExpression(''); setResult('0'); }
            }}
            inputMode="text"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck="false"
            placeholder="0"
            aria-label="Math expression"
          />
          <output className="result" aria-live="polite">{result}</output>
          <div className={`status ${status ? 'visible' : ''}`} aria-live="polite">{status || 'Ready'}</div>
        </div>

        {scientific && (
          <div className="scientific-grid" aria-label="Scientific calculator keys">
            {scientificKeys.map((key) => <button type="button" key={key.label} onClick={() => onKey(key)}>{key.label}</button>)}
          </div>
        )}

        <div className="keypad">
          {keys.map((key) => (
            <button type="button" key={key.label} className={`${key.tone || ''} ${key.wide ? 'wide' : ''}`} onClick={() => onKey(key)}>{key.label}</button>
          ))}
        </div>

        <input ref={fileInputRef} className="hidden-file" type="file" accept="image/*" onChange={onImageUpload} tabIndex={-1} aria-hidden="true" />
        <video ref={videoRef} className="camera-source" playsInline muted aria-hidden="true" />
        <canvas ref={canvasRef} className="camera-source" aria-hidden="true" />
      </section>
    </main>
  );
}
