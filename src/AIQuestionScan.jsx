import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createWorker } from 'tesseract.js';
import './ai-question-scan.css';

function cleanQuestionText(rawText) {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1400);
}

async function askAI(question) {
  const response = await fetch('/api/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || 'Could not answer that question');
  if (!data?.answer) throw new Error('No answer returned');
  return String(data.answer).trim();
}

export default function AIQuestionScan() {
  const [toolsTarget, setToolsTarget] = useState(null);
  const [displayTarget, setDisplayTarget] = useState(null);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(false);
  const workerRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    setToolsTarget(document.querySelector('.display-tools'));
    setDisplayTarget(document.querySelector('.display'));

    return () => {
      workerRef.current?.terminate?.();
      videoRef.current?.srcObject?.getTracks?.().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (!displayTarget) return undefined;
    displayTarget.classList.toggle('ai-answer-active', active);
    return () => displayTarget.classList.remove('ai-answer-active');
  }, [displayTarget, active]);

  useEffect(() => {
    const calculator = document.querySelector('.calculator');
    if (!calculator) return undefined;

    const dismissOnCalculatorUse = (event) => {
      if (event.target.closest('.ai-question-button')) return;
      if (event.target.closest('button, input')) {
        setActive(false);
        setAnswer('');
      }
    };

    calculator.addEventListener('click', dismissOnCalculatorUse);
    calculator.addEventListener('input', dismissOnCalculatorUse);
    return () => {
      calculator.removeEventListener('click', dismissOnCalculatorUse);
      calculator.removeEventListener('input', dismissOnCalculatorUse);
    };
  }, []);

  const getWorker = async () => {
    if (workerRef.current) return workerRef.current;
    workerRef.current = await createWorker('eng');
    return workerRef.current;
  };

  const captureFrame = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera scanning is not supported in this browser');
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
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
      if (!blob) throw new Error('Could not capture image');
      return blob;
    } finally {
      stream?.getTracks?.().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    }
  };

  const scanQuestion = async () => {
    if (busy) return;
    setBusy(true);
    setActive(true);
    setAnswer('…');

    try {
      const image = await captureFrame();
      const worker = await getWorker();
      const { data } = await worker.recognize(image);
      const question = cleanQuestionText(data.text || '');
      if (!question) throw new Error('No readable question found');

      const shortAnswer = await askAI(question);
      setAnswer(shortAnswer);
    } catch (error) {
      const message = error?.name === 'NotAllowedError'
        ? 'Camera permission needed'
        : (error?.message || 'Try again');
      setAnswer(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {toolsTarget && createPortal(
        <button
          className={`mini-button ai-question-button ${busy ? 'active' : ''}`}
          type="button"
          aria-label="Scan a non-math question with AI"
          title="Question scan"
          onClick={scanQuestion}
          disabled={busy}
        >
          ?
        </button>,
        toolsTarget,
      )}

      {displayTarget && active && createPortal(
        <output className="ai-answer-output" aria-live="polite">
          {answer}
        </output>,
        displayTarget,
      )}

      <video ref={videoRef} className="camera-source" playsInline muted aria-hidden="true" />
      <canvas ref={canvasRef} className="camera-source" aria-hidden="true" />
    </>
  );
}
