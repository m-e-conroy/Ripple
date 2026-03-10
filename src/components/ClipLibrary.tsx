import React, { useRef } from 'react';
import { useAudioStore, AudioClip } from '../store/useAudioStore';
import { engine } from '../engine/AudioEngine';
import { v4 as uuidv4 } from 'uuid';
import { FileAudio, Upload } from 'lucide-react';

export default function ClipLibrary() {
  const { clips, addClip } = useAudioStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await engine.decodeAudioData(arrayBuffer);
        
        const clip: AudioClip = {
          id: uuidv4(),
          filename: file.name,
          buffer: audioBuffer,
          duration: audioBuffer.duration,
        };
        
        addClip(clip);
      } catch (error) {
        console.error('Error decoding audio', error);
        alert(`Failed to load ${file.name}`);
      }
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragStart = (e: React.DragEvent, clipId: string) => {
    e.dataTransfer.setData('text/plain', clipId);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="w-64 bg-ripple-panel border-r border-ripple-cyan/20 flex flex-col shrink-0">
      <div className="p-4 border-b border-ripple-cyan/20">
        <h2 className="text-sm font-semibold text-ripple-cyan uppercase tracking-wider mb-3">Clip Library</h2>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center justify-center space-x-2 py-2 px-4 bg-ripple-cyan/10 hover:bg-ripple-cyan/20 text-ripple-cyan rounded text-sm font-medium transition-colors"
        >
          <Upload size={16} />
          <span>Import Audio</span>
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          multiple
          accept="audio/*"
          className="hidden"
        />
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {Object.values(clips).map((clip) => (
          <div
            key={clip.id}
            draggable
            onDragStart={(e) => handleDragStart(e, clip.id)}
            className="flex items-center space-x-3 p-3 bg-ripple-bg/50 hover:bg-ripple-cyan/10 rounded cursor-grab active:cursor-grabbing group transition-colors border border-ripple-cyan/10"
          >
            <FileAudio size={18} className="text-ripple-muted group-hover:text-ripple-cyan" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate text-ripple-text group-hover:text-white">
                {clip.filename}
              </div>
              <div className="text-xs text-ripple-muted font-mono">
                {clip.duration.toFixed(2)}s
              </div>
            </div>
          </div>
        ))}
        {Object.keys(clips).length === 0 && (
          <div className="text-center p-4 text-sm text-ripple-muted italic">
            No clips imported yet.
          </div>
        )}
      </div>
    </div>
  );
}
