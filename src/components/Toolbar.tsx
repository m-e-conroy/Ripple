import React from 'react';
import { useAudioStore } from '../store/useAudioStore';
import { engine } from '../engine/AudioEngine';
import { Play, Square, Scissors, Copy, ClipboardPaste, Download, Plus, Undo2, Redo2, ZoomIn, ZoomOut } from 'lucide-react';

export default function Toolbar() {
  const { isPlaying, playheadPosition, duration, addTrack, copyRegion, pasteRegion, splitRegion, pixelsPerSecond, setPixelsPerSecond, tracks } = useAudioStore();
  const { undo, redo } = useAudioStore.temporal.getState();

  const maxTime = Math.max(
    duration,
    ...tracks.flatMap(t => t.regions.map(r => r.startTime + r.duration))
  );
  const projectDuration = maxTime;

  const handlePlayPause = () => {
    if (isPlaying) {
      engine.stop();
    } else {
      engine.play();
    }
  };

  const handleStop = () => {
    engine.stop();
    useAudioStore.getState().setPlayheadPosition(0);
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const handleExport = async (format: 'wav' | 'mp3') => {
    try {
      const blob = format === 'wav' ? await engine.exportWav() : await engine.exportMp3();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed', error);
      alert('Export failed. See console for details.');
    }
  };

  return (
    <div className="h-14 bg-zinc-800 border-b border-zinc-700 flex items-center px-4 justify-between shrink-0">
      <div className="flex items-center space-x-2">
        <button
          onClick={handlePlayPause}
          className={`p-2 rounded hover:bg-zinc-700 ${isPlaying ? 'text-emerald-400' : 'text-zinc-300'}`}
          title="Play/Pause"
        >
          <Play size={20} className={isPlaying ? 'fill-current' : ''} />
        </button>
        <button
          onClick={handleStop}
          className="p-2 rounded hover:bg-zinc-700 text-zinc-300"
          title="Stop"
        >
          <Square size={20} className="fill-current" />
        </button>
        <div className="font-mono text-xl ml-4 text-emerald-400 w-32">
          {formatTime(playheadPosition)}
        </div>
      </div>

      <div className="flex items-center space-x-2 border-l border-zinc-700 pl-4">
        <button onClick={() => undo()} className="p-2 rounded hover:bg-zinc-700 text-zinc-300" title="Undo">
          <Undo2 size={18} />
        </button>
        <button onClick={() => redo()} className="p-2 rounded hover:bg-zinc-700 text-zinc-300" title="Redo">
          <Redo2 size={18} />
        </button>
      </div>

      <div className="flex items-center space-x-2 border-l border-zinc-700 pl-4">
        <button onClick={splitRegion} className="p-2 rounded hover:bg-zinc-700 text-zinc-300" title="Split Region">
          <Scissors size={18} />
        </button>
        <button onClick={copyRegion} className="p-2 rounded hover:bg-zinc-700 text-zinc-300" title="Copy Region">
          <Copy size={18} />
        </button>
        <button onClick={pasteRegion} className="p-2 rounded hover:bg-zinc-700 text-zinc-300" title="Paste Region">
          <ClipboardPaste size={18} />
        </button>
      </div>

      <div className="flex items-center space-x-2 border-l border-zinc-700 pl-4">
        <button onClick={() => setPixelsPerSecond(pixelsPerSecond / 1.5)} className="p-2 rounded hover:bg-zinc-700 text-zinc-300" title="Zoom Out">
          <ZoomOut size={18} />
        </button>
        <button onClick={() => setPixelsPerSecond(pixelsPerSecond * 1.5)} className="p-2 rounded hover:bg-zinc-700 text-zinc-300" title="Zoom In">
          <ZoomIn size={18} />
        </button>
      </div>

      <div className="flex-1 flex justify-center">
        <button
          onClick={addTrack}
          className="flex items-center space-x-1 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          <span>Add Track</span>
        </button>
      </div>

      <div className="flex items-center space-x-4">
        <div className="text-xs text-zinc-500 font-mono">
          {formatTime(projectDuration)}
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => handleExport('wav')}
            className="flex items-center space-x-2 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded font-medium transition-colors text-sm"
          >
            <Download size={14} />
            <span>WAV</span>
          </button>
          <button
            onClick={() => handleExport('mp3')}
            className="flex items-center space-x-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium transition-colors text-sm"
          >
            <Download size={14} />
            <span>MP3</span>
          </button>
        </div>
      </div>
    </div>
  );
}
