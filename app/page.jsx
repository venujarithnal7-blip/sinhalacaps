"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function HomePage() {
  const [fontFamily, setFontFamily] = useState("Arial");
  const [timingOffset, setTimingOffset] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoName, setVideoName] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [showTip, setShowTip] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const [words, setWords] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);

  const [xPosition, setXPosition] = useState(50);
  const [yPosition, setYPosition] = useState(84);
  const [fontSize, setFontSize] = useState(44);
  const [fontColor, setFontColor] = useState("#ffffff");
  const [bgColor, setBgColor] = useState("#ff2d55");
  const [bgOpacity, setBgOpacity] = useState(0.65);
  const [bgRadius, setBgRadius] = useState(12);
  const [useTextGradient, setUseTextGradient] = useState(false);
  const [textGradientFrom, setTextGradientFrom] = useState("#ffffff");
  const [textGradientTo, setTextGradientTo] = useState("#ffcc00");
  const [textShine, setTextShine] = useState(false);

  const [showBackground, setShowBackground] = useState(false);
  const [isBold, setIsBold] = useState(true);
  const [shadow, setShadow] = useState(true);
  const [outlineSize, setOutlineSize] = useState(2);

  const [coins, setCoins] = useState(0);
  const [userEmail, setUserEmail] = useState("");
  const [loadingCoins, setLoadingCoins] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const videoRef = useRef(null);
  const animationRef = useRef(null);
// ── Replace the two useMemo blocks in page.jsx with these ──────────────────
//
// Fix 1: timingOffset is no longer divided by speed.
//         Speed compresses/stretches word durations.
//         Offset shifts captions earlier/later in real seconds — independent.
//
// Fix 2: activeWord gap tolerance is 0.3s max.
//         The old code kept showing the last word for the entire rest of the
//         video during silences. Now it clears after 0.3 s of silence.

// ── Replace the two useMemo blocks in page.jsx with these ──────────────────

const adjustedWords = useMemo(() => {
  return words.map((w) => ({
    ...w,
   start: w.start + timingOffset,
end: w.start + (w.end - w.start) / speed + timingOffset,
  }));
}, [words, timingOffset, speed]);

const activeWord = useMemo(() => {
  if (!adjustedWords || adjustedWords.length === 0) return null;

  // Exact match: video time is inside this word's window
  const match = adjustedWords.find(
    (word) => currentTime >= word.start && currentTime <= word.end
  );
  if (match) return match;

  // Gap bridge: show previous word for up to 1.5s of silence.
  // Matches the 1.5s gap threshold in buildEnglishCaptions so captions
  // never disappear mid-sentence. Beyond 1.5s is intentional silence
  // (pause between topics) so return null and clear the caption.
  for (let i = adjustedWords.length - 1; i >= 0; i--) {
    if (currentTime >= adjustedWords[i].start) {
if (currentTime - adjustedWords[i].end <= 0.35) return adjustedWords[i];
      break;
    }
  }

  return null;
}, [currentTime, adjustedWords]);

  useEffect(() => {
    getUserAndCoins();
  }, []);

  useEffect(() => {
  return () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };
}, []);

  async function getUserAndCoins() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setCoins(0);
      setUserEmail("");
      setLoadingCoins(false);
      return;
    }

    setUserEmail(user.email || "");

    const { data } = await supabase
      .from("profiles")
      .select("coins")
      .eq("id", user.id)
      .single();

    setCoins(data?.coins || 0);
    setLoadingCoins(false);
  }

  function handleVideoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setVideoFile(file);

    const fileUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = fileUrl;

    video.onloadedmetadata = () => {
      const duration = video.duration;

      if (duration > 60) {
        alert("Video length must be 1 minute or less.");
        URL.revokeObjectURL(fileUrl);
        return;
      }

      setVideoUrl(fileUrl);
      setVideoName(file.name);
      setCurrentTime(0);
    };
  }

async function handleDownloadVideo() {
  if (!videoFile || words.length === 0) {
    alert("Generate captions first");
    return;
  }

  setIsDownloading(true);
  setExportProgress(0);

  // ✅ Unique export ID
  const exportId = Date.now().toString();

  // ✅ Start listening to progress
  

  try {
    const videoEl = videoRef.current;
    const videoWidth = videoEl?.videoWidth || 1080;
    const videoHeight = videoEl?.videoHeight || 1920;
    const containerWidth = videoEl?.offsetWidth || 640;
    const containerHeight = videoEl?.offsetHeight || 360;

    const videoAspect = videoWidth / videoHeight;
    const containerAspect = containerWidth / containerHeight;

    let renderedWidth, renderedHeight, offsetX, offsetY;

    if (videoAspect > containerAspect) {
      renderedWidth = containerWidth;
      renderedHeight = containerWidth / videoAspect;
      offsetX = 0;
      offsetY = (containerHeight - renderedHeight) / 2;
    } else {
      renderedHeight = containerHeight;
      renderedWidth = containerHeight * videoAspect;
      offsetX = (containerWidth - renderedWidth) / 2;
      offsetY = 0;
    }

    const captionPixelX = (xPosition / 100) * containerWidth;
    const captionPixelY = (yPosition / 100) * containerHeight;
    const adjustedX = ((captionPixelX - offsetX) / renderedWidth) * 100;
    const adjustedY = ((captionPixelY - offsetY) / renderedHeight) * 100;

    const formData = new FormData();
    formData.append("video", videoFile);
    formData.append("words", JSON.stringify(adjustedWords));
    formData.append("mode", "pro");
    
    formData.append(
      "styles",
      JSON.stringify({
        xPosition: adjustedX,
        yPosition: adjustedY,
        fontSize,
        fontColor,
        fontFamily,
        isBold,
        shadow,
        outlineSize,
        showBackground,
        bgColor,
        bgOpacity,
        bgRadius,
        videoWidth,
        videoHeight,
      })
    );

    const res = await fetch("/api/export-video", {
      method: "POST",
      body: formData,
    });


    if (!res.ok) {
      const errorText = await res.text();
      console.error("Export failed:", errorText);
      alert("Export failed. Check terminal error.");
      return;
    }

    const blob = await res.blob();
    if (blob.size < 1000) {
      alert("Export failed. File is too small.");
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "captioned.mp4";
    a.click();
    URL.revokeObjectURL(url);

  } catch (error) {
    console.error("Download error:", error);
    alert("Export failed. Check terminal error.");
  } finally {
    
    setIsDownloading(false);
   
  }
}

  async function handleGenerateCaptions() {

    

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Please login first.");
      return;
    }

    if (!videoFile) {
      alert("Please upload a video first.");
      return;
    }

    if (coins <= 0) {
      alert("Your coins are finished. Please buy more coins.");
      return;
    }

    try {
      setIsGenerating(true);

      const formData = new FormData();
      formData.append("video", videoFile);

      const res = await fetch("/api/generate-captions", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (!result.success) {
        alert(result.error || "Caption generation failed.");
        return;
      }

      setWords(result.words || []);

      setShowTip(true);
      setCurrentTime(0);

if (videoRef.current) {
  videoRef.current.pause();
  videoRef.current.currentTime = 0;
}

      const newCoins = coins - 1;

      await supabase
        .from("profiles")
        .update({ coins: newCoins })
        .eq("id", user.id);

      setCoins(newCoins);
    } catch (error) {
      console.error(error);
      alert("Error generating captions");
    } finally {
      setIsGenerating(false);
    }
  }

  function updateCaptionTime() {
  if (videoRef.current) {
    setCurrentTime(videoRef.current.currentTime);
    animationRef.current = requestAnimationFrame(updateCaptionTime);
  }
}

function startTracking() {
  if (animationRef.current) cancelAnimationFrame(animationRef.current);
  animationRef.current = requestAnimationFrame(updateCaptionTime);
}

function stopTracking() {
  if (animationRef.current) {
    cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
  }
}

  async function handlePlay() {
    if (!videoRef.current) return;

    try {
      videoRef.current.muted = false;
      videoRef.current.volume = 1;
      await videoRef.current.play();
    } catch (error) {
      console.log(error);
    }
  }

  function handleStop() {
    if (!videoRef.current) return;
    videoRef.current.pause();
    videoRef.current.currentTime = 0;
    setCurrentTime(0);
  }

  function handleResetCaptions() {
    setWords([]);
    setCurrentTime(0);

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }

  function handleWordChange(id, newValue) {
    setWords((prev) =>
      prev.map((word) => (word.id === id ? { ...word, text: newValue } : word))
    );
  }

  function handleDeleteWord(id) {
    setWords((prev) => prev.filter((word) => word.id !== id));
  }

  function handleAddWord() {
    const lastWord = words[words.length - 1];
    const start = lastWord ? lastWord.end : 0;
    const end = start + 0.5;

    const newWord = {
      id: Date.now(),
      text: "නව",
      start,
      end,
    };

    setWords((prev) => [...prev, newWord]);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUserEmail("");
    setCoins(0);
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-zinc-800 bg-zinc-900 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Sinhala Caption Generator</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Fast moving captions with editable words and coin system
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              {userEmail ? `Logged in: ${userEmail}` : "Not logged in"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl bg-zinc-950 px-4 py-3 text-center">
              <p className="text-sm text-zinc-400">Coins</p>
              <p className="text-2xl font-bold">
                {loadingCoins ? "..." : coins}
              </p>
            </div>

            {userEmail ? (
              <button
                onClick={handleLogout}
                className="rounded-2xl bg-white px-4 py-3 font-semibold text-black hover:bg-zinc-200"
              >
                Logout
              </button>
            ) : (
              <Link
                href="/login"
                className="rounded-2xl bg-white px-4 py-3 font-semibold text-black hover:bg-zinc-200"
              >
                Login
              </Link>
            )}

           <Link
  href="/buy-coins"
  target="_blank"
  rel="noopener noreferrer"
  className="rounded-2xl bg-yellow-400 px-4 py-3 font-semibold text-black hover:bg-yellow-300"
>
  Buy Coins
</Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-4 flex flex-wrap gap-3">
              <label className="cursor-pointer rounded-2xl bg-white px-4 py-2 font-medium text-black hover:bg-zinc-200">
                Upload Video
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleVideoUpload}
                />
              </label>

              <button
                onClick={handleGenerateCaptions}
                disabled={isGenerating}
                className="rounded-2xl bg-emerald-500 px-4 py-2 font-medium text-black hover:bg-emerald-400 disabled:opacity-60"
              >
                {isGenerating ? "Generating..." : "Generate Captions ( 1 coin )"}
              </button>

              <button
                onClick={handlePlay}
                className="rounded-2xl bg-blue-500 px-4 py-2 font-medium text-white hover:bg-blue-400"
              >
                Play
              </button>

              <button
                onClick={handleStop}
                className="rounded-2xl bg-red-500 px-4 py-2 font-medium text-white hover:bg-red-400"
              >
                Stop
              </button>

              <button
                onClick={handleResetCaptions}
                className="rounded-2xl bg-zinc-700 px-4 py-2 font-medium hover:bg-zinc-600"
              >
                Reset
              </button>
               
             <button
  onClick={handleDownloadVideo}
  disabled={isDownloading}
  className="rounded-2xl bg-purple-500 px-4 py-2 font-medium text-white hover:bg-purple-400 disabled:opacity-60 flex items-center gap-2"
>
  {isDownloading ? (
    <>
      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
      Exporting...
    </>
  ) : (
    "Download Video"
  )}
</button>

                 {showTip && (
  <div className="mt-4 rounded-2xl bg-blue-500/10 border border-blue-400/30 p-3 text-sm text-blue-300">
    ⚡ Adjust timing using "Timing Offset" if captions feel early or delayed.
  </div>
)}


            </div>

            <div className="mb-3 text-sm text-zinc-400">
              {videoName ? `Uploaded: ${videoName}` : "No video uploaded yet"}
            </div>

            <div className="relative aspect-video overflow-hidden rounded-3xl bg-black">
              {videoUrl ? (
          <video
  ref={videoRef}
  src={videoUrl}
  controls
  playsInline
  preload="metadata"
  onPlay={startTracking}
  onPause={stopTracking}
  onEnded={() => {
    stopTracking();
    setCurrentTime(0);
  }}
  onSeeked={() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }}
  onLoadedMetadata={() => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.volume = 1;
    }
  }}
  className="h-full w-full object-contain"
/>
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-500">
                  Your uploaded video will appear here
                </div>
              )}

              {activeWord && (
                <div
                  className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 px-4 py-2 text-center"
                  style={{
                    left: `${xPosition}%`,
                    top: `${yPosition}%`,
                    fontSize: `${fontSize}px`,
                    color: fontColor,
                    fontFamily: fontFamily,
                    fontWeight: isBold ? "800" : "400",
                    textShadow: shadow
                      ? `0 0 ${outlineSize}px black, 0 0 ${
                          outlineSize * 2
                        }px black`
                      : "none",
                   backgroundColor: showBackground
  ? `${bgColor}${Math.round(bgOpacity * 255)
      .toString(16)
      .padStart(2, "0")}`
  : "transparent",
borderRadius: `${bgRadius}px`,
                  }}
                >
                  {activeWord.text}
                </div>
              )}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-zinc-300">
                  X Position: {xPosition}
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={xPosition}
                  onChange={(e) => setXPosition(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-zinc-300">
                  Y Position: {yPosition}
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={yPosition}
                  onChange={(e) => setYPosition(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-zinc-300">
                  Font Size: {fontSize}px
                </label>
                <input
                  type="range"
                  min="10"
                  max="90"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-full"
                />
              </div>

             <div className="mt-2 col-span-2">
  <label className="mb-2 block text-sm text-zinc-300">
    Font Family
  </label>
<select
  value={fontFamily}
  onChange={(e) => setFontFamily(e.target.value)}
  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-white"
>
  {/* 🔥 Sinhala fonts (BEST) */}
  <option value="'Noto Sans Sinhala'">Noto Sans Sinhala (Best)</option>
  <option value="'Noto Serif Sinhala'">Noto Serif Sinhala</option>

  {/* 🔥 Stylish fonts */}
  <option value="Poppins">Poppins</option>
  <option value="Montserrat">Montserrat</option>
  <option value="Roboto">Roboto</option>

  {/* 🔥 System Sinhala fonts */}
  <option value="Iskoola Pota">Iskoola Pota</option>
  <option value="FM Abhaya">FM Abhaya</option>
  <option value="Malithi Web">Malithi Web</option>

  {/* 🔥 Extra fallback */}
  <option value="Arial">Default</option>
</select>
</div>

              <div>
                <label className="mb-2 block text-sm text-zinc-300">
                  Font Color
                </label>
                <input
                  type="color"
                  value={fontColor}
                  onChange={(e) => setFontColor(e.target.value)}
                  className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-zinc-300">
                  Outline Strength: {outlineSize}
                </label>
                <input
                  type="range"
                  min="0"
                  max="6"
                  value={outlineSize}
                  onChange={(e) => setOutlineSize(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="flex flex-col justify-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3">

               <div className="col-span-2 mt-4">
  <label className="block text-sm text-zinc-300 mb-2">
    Timing Offset: {timingOffset.toFixed(2)}s
  </label>

  <div className="flex gap-2">
    <button
      onClick={() => setTimingOffset((prev) => prev - 0.1)}
      className="px-3 py-1 bg-zinc-800 rounded"
    >
      -0.1s
    </button>

    <button
      onClick={() => setTimingOffset((prev) => prev + 0.1)}
      className="px-3 py-1 bg-zinc-800 rounded"
    >
      +0.1s
    </button>
  </div>
</div>

<div className="col-span-2 mt-4">
  <label className="block text-sm text-zinc-300 mb-2">
    Caption Speed: {speed.toFixed(2)}x
  </label>

  <input
    type="range"
    min="0.8"
    max="1.2"
    step="0.01"
    value={speed}
    onChange={(e) => setSpeed(Number(e.target.value))}
    className="w-full"
  />
</div>




                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={showBackground}
                    onChange={() => setShowBackground(!showBackground)}
                  />
                  <span>Background Box</span>

                 

                </label>

                {showBackground && (
  <div className="mt-3 space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
    <div>
      <label className="mb-2 block text-sm text-zinc-300">
        Background Color
      </label>
      <input
        type="color"
        value={bgColor}
        onChange={(e) => setBgColor(e.target.value)}
        className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900"
      />
    </div>

    <div>
      <label className="mb-2 block text-sm text-zinc-300">
        Background Opacity: {Math.round(bgOpacity * 100)}%
      </label>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={bgOpacity}
        onChange={(e) => setBgOpacity(Number(e.target.value))}
        className="w-full"
      />
    </div>

    <div>
      <label className="mb-2 block text-sm text-zinc-300">
        Corner Radius: {bgRadius}px
      </label>
      <input
        type="range"
        min="0"
        max="40"
        value={bgRadius}
        onChange={(e) => setBgRadius(Number(e.target.value))}
        className="w-full"
      />
    </div>
  </div>
)}


                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={shadow}
                    onChange={() => setShadow(!shadow)}
                  />
                  <span>Shadow / Outline</span>
                </label>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isBold}
                    onChange={() => setIsBold(!isBold)}
                  />
                  <span>Bold Text</span>
                </label>
              </div>
            </div>
          </section>

          

          <aside className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Caption Editor</h2>
              <button
                onClick={handleAddWord}
                className="rounded-xl bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700"
              >
                Add Word
              </button>
            </div>

            <div className="space-y-3">
              {words.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-700 p-4 text-sm text-zinc-500">
                  Generated caption words will appear here
                </div>
              ) : (
                words.map((word) => (
                  <div
                    key={word.id}
                    className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs text-zinc-500">
                        {word.start.toFixed(1)}s - {word.end.toFixed(1)}s
                      </span>

                      <button
                        onClick={() => handleDeleteWord(word.id)}
                        className="text-sm text-red-400 hover:text-red-300"
                      >
                        Delete
                      </button>
                    </div>

                    <input
                      type="text"
                      value={word.text}
                      onChange={(e) => handleWordChange(word.id, e.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none"
                    />
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}