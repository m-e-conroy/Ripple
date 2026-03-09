import React, { useEffect, useRef, useState } from 'react';
import { useAudioStore, Region } from '../store/useAudioStore';
import interact from 'interactjs';

interface Props {
  key?: string | number;
  region: Region;
  pixelsPerSecond: number;
}

export default function RegionComponent({ region, pixelsPerSecond }: Props) {
  const { clips, selectedRegionId, selectRegion, updateRegion, deleteRegion, playheadPosition } = useAudioStore();
  const clip = clips[region.sourceClipId];
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const playheadRef = useRef(playheadPosition);

  useEffect(() => {
    playheadRef.current = playheadPosition;
  }, [playheadPosition]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    interact(el)
      .draggable({
        inertia: false,
        autoScroll: true,
        listeners: {
          start(event) {
            setIsDragging(true);
            selectRegion(region.id);
            // Bring to front while dragging
            event.target.style.zIndex = '50';
            
            const trackRow = event.target.closest('.track-row') as HTMLElement;
            if (trackRow) {
              trackRow.style.zIndex = '50';
              trackRow.style.position = 'relative';
            }
            
            event.target.setAttribute('data-raw-x', event.target.getAttribute('data-x') || '0');
          },
          move(event) {
            const target = event.target;
            const rawX = (parseFloat(target.getAttribute('data-raw-x')) || 0) + event.dx;
            const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;
            
            target.setAttribute('data-raw-x', rawX.toString());
            target.setAttribute('data-y', y.toString());
            
            let x = rawX;
            
            // Snapping logic
            const currentStartPixel = region.startTime * pixelsPerSecond + rawX;
            const currentEndPixel = currentStartPixel + region.duration * pixelsPerSecond;
            const playheadPixel = playheadRef.current * pixelsPerSecond;
            const snapThreshold = 15; // pixels
            
            if (Math.abs(currentStartPixel - playheadPixel) < snapThreshold) {
              x = playheadPixel - region.startTime * pixelsPerSecond;
            } else if (Math.abs(currentEndPixel - playheadPixel) < snapThreshold) {
              x = playheadPixel - (region.startTime + region.duration) * pixelsPerSecond;
            }
            
            target.style.transform = `translate(${x}px, ${y}px)`;
            target.setAttribute('data-x', x.toString());
          },
          end(event) {
            setIsDragging(false);
            const target = event.target;
            const x = parseFloat(target.getAttribute('data-x')) || 0;
            const dropTrackId = target.getAttribute('data-drop-track-id');
            
            // Calculate new start time based on pixels moved
            const timeDelta = x / pixelsPerSecond;
            const newStartTime = Math.max(0, region.startTime + timeDelta);
            
            const updates: Partial<Region> = { startTime: newStartTime };
            if (dropTrackId && dropTrackId !== region.trackId) {
              updates.trackId = dropTrackId;
            }
            
            updateRegion(region.id, updates);
            
            // Reset transform and data-x/y since React will re-render with new left position
            target.style.transform = 'none';
            target.setAttribute('data-x', '0');
            target.setAttribute('data-raw-x', '0');
            target.setAttribute('data-y', '0');
            target.removeAttribute('data-drop-track-id');
            target.style.zIndex = '';
            
            const trackRow = target.closest('.track-row') as HTMLElement;
            if (trackRow) {
              trackRow.style.zIndex = '';
              trackRow.style.position = '';
            }
          }
        }
      })
      .resizable({
        edges: { left: true, right: true, bottom: false, top: false },
        listeners: {
          start(event) {
            const target = event.target;
            target.setAttribute('data-raw-width', (region.duration * pixelsPerSecond).toString());
            target.setAttribute('data-raw-x', target.getAttribute('data-x') || '0');
          },
          move(event) {
            const target = event.target;
            let rawX = parseFloat(target.getAttribute('data-raw-x')) || 0;
            let rawWidth = parseFloat(target.getAttribute('data-raw-width')) || (region.duration * pixelsPerSecond);
            
            if (event.edges.left) {
              rawX += event.deltaRect.left;
              rawWidth += event.deltaRect.width;
            } else if (event.edges.right) {
              rawWidth += event.deltaRect.width;
            }
            
            target.setAttribute('data-raw-x', rawX.toString());
            target.setAttribute('data-raw-width', rawWidth.toString());
            
            let x = rawX;
            let width = rawWidth;
            
            const playheadPixel = playheadRef.current * pixelsPerSecond;
            const snapThreshold = 15; // pixels

            if (event.edges.left) {
              const currentStartPixel = region.startTime * pixelsPerSecond + rawX;
              if (Math.abs(currentStartPixel - playheadPixel) < snapThreshold) {
                const snapDelta = playheadPixel - currentStartPixel;
                x += snapDelta;
                width -= snapDelta;
              }
            } else if (event.edges.right) {
              const currentEndPixel = region.startTime * pixelsPerSecond + rawWidth;
              if (Math.abs(currentEndPixel - playheadPixel) < snapThreshold) {
                const snapDelta = playheadPixel - currentEndPixel;
                width += snapDelta;
              }
            }
            
            if (width < 10) {
              width = 10;
              if (event.edges.left) {
                x = rawX + (rawWidth - 10);
              }
            }

            target.style.width = width + 'px';
            if (event.edges.left) {
              target.style.transform = `translate(${x}px, 0)`;
              target.setAttribute('data-x', x.toString());
            }
          },
          end(event) {
            const target = event.target;
            const x = parseFloat(target.getAttribute('data-x')) || 0;
            const newWidth = parseFloat(target.style.width);
            
            const timeDelta = x / pixelsPerSecond;
            const newStartTime = Math.max(0, region.startTime + timeDelta);
            
            const durationDelta = (newWidth / pixelsPerSecond) - region.duration;
            const newDuration = Math.max(0.1, region.duration + durationDelta);
            
            let newClipOffset = region.clipOffset;
            if (event.edges.left) {
              newClipOffset = Math.max(0, region.clipOffset + timeDelta);
            }
            
            updateRegion(region.id, { 
              startTime: newStartTime,
              duration: newDuration,
              clipOffset: newClipOffset
            });
            
            target.style.transform = 'none';
            target.setAttribute('data-x', '0');
            target.setAttribute('data-raw-x', '0');
            target.setAttribute('data-raw-width', '0');
            target.style.width = 'auto'; // Let React handle it
          }
        }
      });

    return () => {
      interact(el).unset();
    };
  }, [region.id, region.startTime, region.duration, region.clipOffset, pixelsPerSecond, selectRegion, updateRegion]);

  const isSelected = selectedRegionId === region.id;

  return (
    <div
      ref={containerRef}
      data-region-id={region.id}
      className={`region-draggable absolute top-1 bottom-1 rounded-md border overflow-hidden cursor-grab active:cursor-grabbing group ${
        isSelected ? 'border-emerald-400 shadow-[0_0_0_1px_rgba(52,211,153,1)] z-20' : 'border-zinc-600 z-10'
      } ${isDragging ? 'opacity-80' : 'opacity-100'}`}
      style={{
        left: `${region.startTime * pixelsPerSecond}px`,
        width: `${region.duration * pixelsPerSecond}px`,
        backgroundColor: 'rgba(16, 185, 129, 0.1)', // emerald-500 with opacity
      }}
      onClick={(e) => {
        e.stopPropagation();
        selectRegion(region.id);
      }}
    >
      {/* Clip Name */}
      <div className="absolute top-0 left-0 right-0 px-2 py-1 bg-zinc-900/80 text-[10px] text-zinc-300 font-mono truncate border-b border-zinc-700/50 z-10 flex justify-between items-center">
        <span>{clip?.filename || 'Unknown Clip'}</span>
        {isSelected && (
          <button 
            onClick={(e) => { e.stopPropagation(); deleteRegion(region.id); }}
            className="text-red-400 hover:text-red-300"
          >
            ×
          </button>
        )}
      </div>
      
      {/* Waveform Container */}
      <div className="absolute top-0 bottom-0 left-0 right-0 opacity-50 pointer-events-none">
        <WaveformCanvas clip={clip} region={region} pixelsPerSecond={pixelsPerSecond} />
      </div>

      {/* Resize Handles */}
      <div className="absolute top-0 bottom-0 left-0 w-2 cursor-ew-resize bg-black/0 hover:bg-emerald-400/50 transition-colors z-20" />
      <div className="absolute top-0 bottom-0 right-0 w-2 cursor-ew-resize bg-black/0 hover:bg-emerald-400/50 transition-colors z-20" />
    </div>
  );
}

function WaveformCanvas({ clip, region, pixelsPerSecond }: { clip: any, region: Region, pixelsPerSecond: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !clip || !clip.buffer) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = region.duration * pixelsPerSecond;
    const height = 100; // Match container height
    
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#10b981'; // emerald-500

    const channelData = clip.buffer.getChannelData(0); // Use left channel for visualization
    const sampleRate = clip.buffer.sampleRate;
    
    const startSample = Math.floor(region.clipOffset * sampleRate);
    const endSample = Math.floor((region.clipOffset + region.duration) * sampleRate);
    const samplesToDraw = endSample - startSample;
    
    if (samplesToDraw <= 0) return;

    const step = Math.ceil(samplesToDraw / width);
    const amp = height / 2;

    ctx.beginPath();
    ctx.moveTo(0, amp);

    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;
      
      for (let j = 0; j < step; j++) {
        const sampleIdx = startSample + (i * step) + j;
        if (sampleIdx < channelData.length) {
          const datum = channelData[sampleIdx];
          if (datum < min) min = datum;
          if (datum > max) max = datum;
        }
      }
      
      ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
    }
  }, [clip, region, pixelsPerSecond]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
