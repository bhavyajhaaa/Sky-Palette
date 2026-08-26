"use client";

import { useEffect, useRef, useState } from "react";
import type { HandLandmarker, NormalizedLandmark } from "@mediapipe/tasks-vision";

type HandInput = { pinching: boolean; x: number; y: number };
type Status = "off" | "starting" | "tracking" | "error";

const WASM_PATH =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_PATH =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

function distance(a: NormalizedLandmark, b: NormalizedLandmark) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function drawHand(
  canvas: HTMLCanvasElement,
  landmarks: NormalizedLandmark[] | undefined,
  connections: { start: number; end: number }[],
  pinching: boolean,
) {
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!landmarks) return;
  context.strokeStyle = pinching ? "#ffb000" : "rgba(255,255,255,.72)";
  context.lineWidth = 1.5;
  for (const { start, end } of connections) {
    context.beginPath();
    context.moveTo(landmarks[start].x * canvas.width, landmarks[start].y * canvas.height);
    context.lineTo(landmarks[end].x * canvas.width, landmarks[end].y * canvas.height);
    context.stroke();
  }
  context.fillStyle = pinching ? "#ffb000" : "rgba(255,255,255,.9)";
  for (const point of landmarks) {
    context.beginPath();
    context.arc(point.x * canvas.width, point.y * canvas.height, 2.5, 0, Math.PI * 2);
    context.fill();
  }
}

export function HandTrackingPrototype({
  onHandInput,
}: {
  onHandInput: (input: HandInput) => void;
}) {
  const video = useRef<HTMLVideoElement>(null),
    overlay = useRef<HTMLCanvasElement>(null),
    diagnostic = useRef<HTMLSpanElement>(null),
    stream = useRef<MediaStream | null>(null),
    landmarker = useRef<HandLandmarker | null>(null),
    frame = useRef(0),
    session = useRef(0),
    pinching = useRef(false);
  const [status, setStatus] = useState<Status>("off"),
    [error, setError] = useState("");

  const stop = () => {
    session.current++;
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (video.current) {
      video.current.pause();
      video.current.srcObject = null;
    }
    landmarker.current?.close();
    landmarker.current = null;
    pinching.current = false;
    onHandInput({ pinching: false, x: 0.5, y: 0.5 });
    setStatus("off");
  };

  useEffect(() => stop, []);

  const start = async () => {
    const token = ++session.current;
    setStatus("starting");
    setError("");
    try {
      const [{ FilesetResolver, HandLandmarker }, camera] = await Promise.all([
        import("@mediapipe/tasks-vision"),
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        }),
      ]);
      if (token !== session.current) {
        camera.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = camera;
      const files = await FilesetResolver.forVisionTasks(WASM_PATH);
      if (token !== session.current) return stop();
      landmarker.current = await HandLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      if (token !== session.current) return stop();
      const element = video.current;
      if (!element) return stop();
      element.srcObject = camera;
      await element.play();
      setStatus("tracking");
      let lastVideoTime = -1,
        lastInference = 0;
      const track = (now: number) => {
        if (token !== session.current || !landmarker.current || !video.current)
          return;
        if (
          video.current.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
          video.current.currentTime !== lastVideoTime &&
          now - lastInference >= 1000 / 30
        ) {
          lastVideoTime = video.current.currentTime;
          lastInference = now;
          const result = landmarker.current.detectForVideo(video.current, now),
            hand = result.landmarks[0];
          if (hand) {
            const thumb = hand[4],
              index = hand[8],
              handScale = Math.max(distance(hand[0], hand[9]), 0.001),
              ratio = distance(thumb, index) / handScale,
              nextPinch = pinching.current ? ratio < 0.65 : ratio < 0.48,
              centerX = 1 - (thumb.x + index.x) / 2,
              centerY = (thumb.y + index.y) / 2;
            pinching.current = nextPinch;
            onHandInput({ pinching: nextPinch, x: centerX, y: centerY });
            if (diagnostic.current)
              diagnostic.current.textContent = `${nextPinch ? "PINCH" : "OPEN"} · ${ratio.toFixed(2)}`;
            if (overlay.current)
              drawHand(
                overlay.current,
                hand,
                HandLandmarker.HAND_CONNECTIONS,
                nextPinch,
              );
          } else {
            pinching.current = false;
            onHandInput({ pinching: false, x: 0.5, y: 0.5 });
            if (diagnostic.current) diagnostic.current.textContent = "NO HAND";
            if (overlay.current)
              drawHand(overlay.current, undefined, HandLandmarker.HAND_CONNECTIONS, false);
          }
        }
        frame.current = requestAnimationFrame(track);
      };
      frame.current = requestAnimationFrame(track);
    } catch (cause) {
      stop();
      setStatus("error");
      setError(
        cause instanceof Error ? cause.message : "Camera or hand tracking failed.",
      );
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={status === "off" || status === "error" ? start : stop}
        className="mr-2 whitespace-nowrap bg-transparent px-2 text-[10px]"
        aria-pressed={status === "tracking"}
      >
        {status === "starting"
          ? "Cancel hand test"
          : status === "tracking"
            ? "Stop hand test"
            : "Hand test"}
      </button>
      {status !== "off" && (
        <div className="fixed left-4 top-20 z-40 w-48 overflow-hidden border border-white/25 bg-black text-white shadow-xl">
          <div className="relative aspect-[4/3] bg-black">
            <video
              ref={video}
              muted
              playsInline
              className="h-full w-full -scale-x-100 object-cover"
            />
            <canvas
              ref={overlay}
              width={640}
              height={480}
              className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100"
            />
          </div>
          <div className="flex items-center justify-between px-2 py-1.5 font-mono text-[9px]">
            <span ref={diagnostic}>
              {status === "error" ? "ERROR" : "LOADING"}
            </span>
            <span>pinch test</span>
          </div>
          {error && <p className="border-t border-white/20 px-2 py-2 text-[9px]">{error}</p>}
        </div>
      )}
    </>
  );
}
