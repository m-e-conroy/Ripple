import React, { useState, useEffect, useRef } from 'react';
import { useAudioStore } from '../store/useAudioStore';
import { DrumEngine, DRUM_INSTRUMENTS } from '../engine/DrumEngine';
import { X, Play, Square, Download } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export default function DrumMachineModal() {
  const { isDrumMachineOpen, setDrumMachineOpen, addClip, addRegion, tracks, playheadPosition } = useAudioStore();
  
  const [pattern, setPattern] = useState<boolean[][]>(
    Array(DRUM_INSTRUMENTS.length).fill(null).map(() => Array(16).fill(false))
  );
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isRendering, setIsRendering] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextNoteTimeRef = useRef(0);
  const currentStepRef = useRef(0);
  const timerIDRef = useRef<number | null>(null);
  const lookahead = 25.0; // ms
  const scheduleAheadTime = 0.1; // s

  useEffect(() => {
    if (isDrumMachineOpen && !audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      DrumEngine.loadSamples(audioCtxRef.current);
    }
    if (!isDrumMachineOpen) {
      stopPreview();
    }
  }, [isDrumMachineOpen]);

  const nextNote = () => {
    const secondsPerBeat = 60.0 / bpm;
    nextNoteTimeRef.current += 0.25 * secondsPerBeat; // 16th note
    currentStepRef.current = (currentStepRef.current + 1) % 16;
  };

  const scheduleNote = (stepNumber: number, time: number) => {
    // Update UI
    requestAnimationFrame(() => {
      setCurrentStep(stepNumber);
    });

    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;

    if (pattern[0]?.[stepNumber]) DrumEngine.playSampleOrSynth(ctx, 'Kick', time, () => DrumEngine.createKick(ctx, time));
    if (pattern[1]?.[stepNumber]) DrumEngine.playSampleOrSynth(ctx, 'Snare', time, () => DrumEngine.createSnare(ctx, time));
    if (pattern[2]?.[stepNumber]) DrumEngine.playSampleOrSynth(ctx, 'Hi-Hat', time, () => DrumEngine.createHiHat(ctx, time));
    if (pattern[3]?.[stepNumber]) DrumEngine.playSampleOrSynth(ctx, 'Clap', time, () => DrumEngine.createClap(ctx, time));
    if (pattern[4]?.[stepNumber]) DrumEngine.playSampleOrSynth(ctx, 'Low Tom', time, () => DrumEngine.createTom(ctx, time, 100));
    if (pattern[5]?.[stepNumber]) DrumEngine.playSampleOrSynth(ctx, 'Mid Tom', time, () => DrumEngine.createTom(ctx, time, 150));
    if (pattern[6]?.[stepNumber]) DrumEngine.playSampleOrSynth(ctx, 'Hi Tom', time, () => DrumEngine.createTom(ctx, time, 200), 1.5);
    if (pattern[7]?.[stepNumber]) DrumEngine.playSampleOrSynth(ctx, 'Ride', time, () => DrumEngine.createRide(ctx, time));
    if (pattern[8]?.[stepNumber]) DrumEngine.playSampleOrSynth(ctx, 'Crash', time, () => DrumEngine.createCrash(ctx, time), 0.8);
  };

  const scheduler = () => {
    if (!audioCtxRef.current) return;
    while (nextNoteTimeRef.current < audioCtxRef.current.currentTime + scheduleAheadTime) {
      scheduleNote(currentStepRef.current, nextNoteTimeRef.current);
      nextNote();
    }
    timerIDRef.current = window.setTimeout(scheduler, lookahead);
  };

  const togglePreview = () => {
    if (isPlaying) {
      stopPreview();
    } else {
      if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      setIsPlaying(true);
      currentStepRef.current = 0;
      setCurrentStep(0);
      nextNoteTimeRef.current = audioCtxRef.current!.currentTime + 0.05;
      scheduler();
    }
  };

  const stopPreview = () => {
    setIsPlaying(false);
    if (timerIDRef.current !== null) {
      window.clearTimeout(timerIDRef.current);
      timerIDRef.current = null;
    }
    setCurrentStep(0);
  };

  const toggleStep = (instIndex: number, stepIndex: number) => {
    const newPattern = [...pattern];
    newPattern[instIndex] = [...newPattern[instIndex]];
    newPattern[instIndex][stepIndex] = !newPattern[instIndex][stepIndex];
    setPattern(newPattern);
  };

  const clearPattern = () => {
    setPattern(Array(DRUM_INSTRUMENTS.length).fill(null).map(() => Array(16).fill(false)));
  };

  const handleRender = async () => {
    setIsRendering(true);
    try {
      const buffer = await DrumEngine.renderLoop(pattern, bpm);
      
      const clipId = uuidv4();
      addClip({
        id: clipId,
        filename: `Drum Loop - ${bpm} BPM`,
        buffer,
        duration: buffer.duration
      });

      // Find selected track or use first track
      const targetTrackId = tracks.length > 0 ? tracks[0].id : null;
      if (targetTrackId) {
        addRegion(targetTrackId, {
          sourceClipId: clipId,
          startTime: playheadPosition,
          clipOffset: 0,
          duration: buffer.duration,
        });
      }

      setDrumMachineOpen(false);
    } catch (e) {
      console.error("Failed to render drum loop", e);
    } finally {
      setIsRendering(false);
    }
  };

  if (!isDrumMachineOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-ripple-panel border border-ripple-cyan/30 rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ripple-cyan/20 bg-ripple-bg/50">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🥁</span>
            <h2 className="text-xl font-bold text-ripple-text tracking-wide">Beat Maker</h2>
          </div>
          <button 
            onClick={() => setDrumMachineOpen(false)}
            className="text-ripple-muted hover:text-ripple-cyan transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between px-6 py-4 bg-ripple-bg/30 border-b border-ripple-cyan/10">
          <div className="flex items-center space-x-6">
            <button
              onClick={togglePreview}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
                isPlaying 
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                  : 'bg-ripple-cyan/20 text-ripple-cyan hover:bg-ripple-cyan/30'
              }`}
            >
              {isPlaying ? <Square size={18} /> : <Play size={18} />}
              <span>{isPlaying ? 'Stop' : 'Preview'}</span>
            </button>

            <div className="flex items-center space-x-3">
              <span className="text-sm font-mono text-ripple-muted">BPM</span>
              <input 
                type="range" 
                min="60" 
                max="200" 
                value={bpm}
                onChange={(e) => setBpm(parseInt(e.target.value))}
                className="w-32 accent-ripple-cyan"
              />
              <span className="text-sm font-mono text-ripple-text w-8">{bpm}</span>
            </div>
          </div>

          <button
            onClick={clearPattern}
            className="text-sm text-ripple-muted hover:text-white transition-colors px-3 py-1 border border-ripple-muted/30 rounded hover:border-white/50"
          >
            Clear Grid
          </button>
        </div>

        {/* Grid */}
        <div className="p-6 overflow-auto max-h-[60vh]">
          <div className="min-w-[700px]">
            {/* Step Indicators */}
            <div className="flex mb-3 ml-24 space-x-1">
              {Array(16).fill(0).map((_, i) => (
                <div key={i} className="flex-1 flex justify-center">
                  <div className={`w-2 h-2 rounded-full ${isPlaying && currentStep === i ? 'bg-ripple-cyan shadow-[0_0_8px_rgba(0,229,255,0.8)]' : 'bg-white/10'}`} />
                </div>
              ))}
            </div>

            {/* Instrument Rows */}
            <div className="space-y-3">
              {DRUM_INSTRUMENTS.map((inst, instIndex) => (
                <div key={inst} className="flex items-center">
                  <div className="w-24 shrink-0 font-mono text-sm text-ripple-muted font-semibold">
                    {inst}
                  </div>
                  <div className="flex-1 flex space-x-1">
                    {pattern[instIndex].map((isActive, stepIndex) => {
                      const isBeat = stepIndex % 4 === 0;
                      return (
                        <button
                          key={stepIndex}
                          onClick={() => toggleStep(instIndex, stepIndex)}
                          className={`flex-1 aspect-square rounded-md transition-all duration-100 ${
                            isActive 
                              ? 'bg-ripple-cyan shadow-[0_0_12px_rgba(0,229,255,0.6)] border-transparent scale-105' 
                              : isBeat 
                                ? 'bg-ripple-panel border-2 border-ripple-cyan/30 hover:border-ripple-cyan/60 hover:bg-ripple-cyan/10' 
                                : 'bg-ripple-bg border border-white/10 hover:border-white/30 hover:bg-white/5'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-ripple-cyan/20 bg-ripple-bg/50 flex justify-end">
          <button
            onClick={handleRender}
            disabled={isRendering}
            className="flex items-center space-x-2 bg-ripple-cyan text-black px-6 py-3 rounded-lg font-bold hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRendering ? (
              <span>Rendering...</span>
            ) : (
              <>
                <Download size={18} />
                <span>Render to Track</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
