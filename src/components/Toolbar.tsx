import React, { useState } from 'react';
import { useAudioStore } from '../store/useAudioStore';
import { engine } from '../engine/AudioEngine';
import { Play, Square, Scissors, Copy, ClipboardPaste, Download, Plus, Undo2, Redo2, ZoomIn, ZoomOut } from 'lucide-react';
import ExportModal from './ExportModal';

interface ToolbarProps {
  onOpenAbout?: () => void;
}

export default function Toolbar({ onOpenAbout }: ToolbarProps) {
  const { isPlaying, playheadPosition, duration, addTrack, copyRegion, pasteRegion, splitRegion, pixelsPerSecond, setPixelsPerSecond, tracks } = useAudioStore();
  const { undo, redo } = useAudioStore.temporal.getState();
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

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

  const handleExport = async (format: 'wav' | 'mp3', customDuration?: number) => {
    try {
      const blob = format === 'wav' ? await engine.exportWav(customDuration) : await engine.exportMp3(customDuration);
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
    <>
      <div className="h-14 bg-ripple-panel border-b border-ripple-cyan/20 flex items-center px-4 justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <button onClick={onOpenAbout} className="mr-4 hover:opacity-80 transition-opacity" title="About Ripple">
            <img src="/logo.svg" alt="Ripple Logo" className="h-8 w-8 object-contain" />
          </button>
          <button
            onClick={handlePlayPause}
            className={`p-2 rounded hover:bg-ripple-cyan/10 ${isPlaying ? 'text-ripple-cyan' : 'text-ripple-text'}`}
            title="Play/Pause"
          >
            <Play size={20} className={isPlaying ? 'fill-current' : ''} />
          </button>
          <button
            onClick={handleStop}
            className="p-2 rounded hover:bg-ripple-cyan/10 text-ripple-text"
            title="Stop"
          >
            <Square size={20} className="fill-current" />
          </button>
          <div className="font-mono text-xl ml-4 text-ripple-cyan w-32">
            {formatTime(playheadPosition)}
          </div>
        </div>

        <div className="flex items-center space-x-2 border-l border-ripple-cyan/20 pl-4">
          <button onClick={() => undo()} className="p-2 rounded hover:bg-ripple-cyan/10 text-ripple-text" title="Undo">
            <Undo2 size={18} />
          </button>
          <button onClick={() => redo()} className="p-2 rounded hover:bg-ripple-cyan/10 text-ripple-text" title="Redo">
            <Redo2 size={18} />
          </button>
        </div>

        <div className="flex items-center space-x-2 border-l border-ripple-cyan/20 pl-4">
          <button onClick={splitRegion} className="p-2 rounded hover:bg-ripple-cyan/10 text-ripple-text" title="Split Region">
            <Scissors size={18} />
          </button>
          <button onClick={copyRegion} className="p-2 rounded hover:bg-ripple-cyan/10 text-ripple-text" title="Copy Region">
            <Copy size={18} />
          </button>
          <button onClick={pasteRegion} className="p-2 rounded hover:bg-ripple-cyan/10 text-ripple-text" title="Paste Region">
            <ClipboardPaste size={18} />
          </button>
        </div>

        <div className="flex items-center space-x-2 border-l border-ripple-cyan/20 pl-4">
          <button onClick={() => setPixelsPerSecond(pixelsPerSecond / 1.5)} className="p-2 rounded hover:bg-ripple-cyan/10 text-ripple-text" title="Zoom Out">
            <ZoomOut size={18} />
          </button>
          <button onClick={() => setPixelsPerSecond(pixelsPerSecond * 1.5)} className="p-2 rounded hover:bg-ripple-cyan/10 text-ripple-text" title="Zoom In">
            <ZoomIn size={18} />
          </button>
        </div>

        <div className="flex-1 flex justify-center">
          <button
            onClick={addTrack}
            className="flex items-center space-x-1 px-3 py-1.5 bg-ripple-cyan/10 hover:bg-ripple-cyan/20 text-ripple-cyan rounded text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            <span>Add Track</span>
          </button>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={() => useAudioStore.getState().setDrumMachineOpen(true)}
            className="flex items-center space-x-2 px-3 py-1.5 bg-ripple-purple/20 border border-ripple-purple/50 hover:bg-ripple-purple/40 text-ripple-purple rounded font-medium transition-colors text-sm"
          >
            <span className="text-lg leading-none">🥁</span>
            <span>Beat Maker</span>
          </button>
          <div className="text-xs text-ripple-muted font-mono">
            {formatTime(projectDuration)}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="flex items-center space-x-2 px-3 py-1.5 bg-ripple-panel border border-ripple-cyan/30 hover:bg-ripple-cyan/10 text-ripple-text rounded font-medium transition-colors text-sm"
            >
              <Download size={14} />
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        projectDuration={projectDuration}
        onExport={handleExport}
      />
    </>
  );
}
