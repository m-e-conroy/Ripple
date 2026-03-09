import React, { useRef, useEffect, useState } from 'react';
import { useAudioStore } from '../store/useAudioStore';
import { engine } from '../engine/AudioEngine';
import TrackHeader from './TrackHeader';
import TrackLane from './TrackLane';

export default function Timeline() {
  const { tracks, playheadPosition, duration, addRegion, clips, isPlaying, pixelsPerSecond } = useAudioStore();
  const timelineRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollContainerRef.current || !isPlaying) return;
    
    const container = scrollContainerRef.current;
    const playheadPx = playheadPosition * pixelsPerSecond;
    
    // The visible area for the tracks (excluding the 256px header)
    const visibleLeft = container.scrollLeft;
    const visibleRight = container.scrollLeft + container.clientWidth - 256;
    
    // If playhead is close to the right edge, scroll right
    if (playheadPx > visibleRight - 100) {
      container.scrollLeft = playheadPx - container.clientWidth + 256 + 100;
    } else if (playheadPx < visibleLeft) {
      container.scrollLeft = Math.max(0, playheadPx - 50);
    }
  }, [playheadPosition, pixelsPerSecond, isPlaying]);

  const handleTimelineMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    
    const updatePlayhead = (clientX: number) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = Math.max(0, clientX - rect.left);
      const time = x / pixelsPerSecond;
      engine.setPlayhead(time);
    };

    updatePlayhead(e.clientX);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      updatePlayhead(moveEvent.clientX);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, trackId: string) => {
    e.preventDefault();
    const clipId = e.dataTransfer.getData('text/plain');
    if (!clipId || !clips[clipId]) return;

    const clip = clips[clipId];
    if (!timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const startTime = Math.max(0, x / pixelsPerSecond);

    addRegion(trackId, {
      sourceClipId: clipId,
      startTime,
      clipOffset: 0,
      duration: clip.duration,
    });
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  // Calculate dynamic timeline duration based on regions
  const maxTime = Math.max(
    duration,
    ...tracks.flatMap(t => t.regions.map(r => r.startTime + r.duration))
  );
  const timelineDuration = Math.max(maxTime + 10, duration);
  const timelineWidth = timelineDuration * pixelsPerSecond;

  // Generate ruler markers
  const markers = [];
  for (let i = 0; i <= timelineDuration; i += 5) {
    markers.push(i);
  }

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden bg-zinc-950">
      <div 
        className="flex-1 overflow-auto relative flex flex-col"
        ref={scrollContainerRef}
      >
        {/* Ruler Row */}
        <div className="h-8 bg-zinc-800 border-b border-zinc-700 flex shrink-0 sticky top-0 z-50 w-max min-w-full">
          <div className="w-64 border-r border-zinc-700 shrink-0 bg-zinc-800 sticky left-0 z-50" />
          <div
            className="relative cursor-pointer"
            onMouseDown={handleTimelineMouseDown}
            ref={timelineRef}
            style={{ width: `${timelineWidth}px` }}
          >
            {markers.map((time) => (
              <div
                key={time}
                className="absolute top-0 bottom-0 border-l border-zinc-700/50 flex flex-col justify-end pb-1 px-1"
                style={{ left: `${time * pixelsPerSecond}px` }}
              >
                <span className="text-[10px] text-zinc-500 font-mono select-none">
                  {time}s
                </span>
              </div>
            ))}
            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-px bg-emerald-500 z-50 pointer-events-none"
              style={{ left: `${playheadPosition * pixelsPerSecond}px` }}
            >
              <div className="absolute top-0 -translate-x-1/2 w-3 h-3 bg-emerald-500 rounded-full" />
            </div>
          </div>
        </div>

        {/* Tracks Area */}
        <div className="flex-1 relative w-max min-w-full">
          {tracks.map((track) => (
            <div key={track.id} className="track-row flex h-32 border-b border-zinc-800/50 group">
              <div className="sticky left-0 z-40 shrink-0 h-full">
                <TrackHeader track={track} />
              </div>
              <div
                className="relative bg-zinc-900/20 hover:bg-zinc-900/40 transition-colors"
                style={{ width: `${timelineWidth}px` }}
                onDrop={(e) => handleDrop(e, track.id)}
                onDragOver={handleDragOver}
              >
                <TrackLane track={track} pixelsPerSecond={pixelsPerSecond} />
                
                {/* Playhead line extending through tracks */}
                <div
                  className="absolute top-0 bottom-0 w-px bg-emerald-500/50 z-30 pointer-events-none"
                  style={{ left: `${playheadPosition * pixelsPerSecond}px` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
