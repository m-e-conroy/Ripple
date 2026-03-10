import React from 'react';
import { useAudioStore, Track } from '../store/useAudioStore';
import { engine } from '../engine/AudioEngine';
import { Volume2, VolumeX, Trash2 } from 'lucide-react';

interface Props {
  track: Track;
}

export default function TrackHeader({ track }: Props) {
  const { updateTrack, deleteTrack, tracks } = useAudioStore();

  const handleMute = () => {
    const newMuted = !track.muted;
    updateTrack(track.id, { muted: newMuted });
    const isAnySolo = tracks.some((t) => t.solo);
    engine.updateTrackVolume(track.id, track.volume, newMuted, track.solo, isAnySolo);
  };

  const handleSolo = () => {
    const newSolo = !track.solo;
    updateTrack(track.id, { solo: newSolo });
    
    // Update all tracks since solo state affects others
    const newIsAnySolo = tracks.some((t) => t.id === track.id ? newSolo : t.solo);
    tracks.forEach((t) => {
      const tSolo = t.id === track.id ? newSolo : t.solo;
      const tMuted = t.id === track.id ? track.muted : t.muted;
      engine.updateTrackVolume(t.id, t.volume, tMuted, tSolo, newIsAnySolo);
    });
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseFloat(e.target.value);
    updateTrack(track.id, { volume });
    const isAnySolo = tracks.some((t) => t.solo);
    engine.updateTrackVolume(track.id, volume, track.muted, track.solo, isAnySolo);
  };

  return (
    <div className="w-64 h-full bg-ripple-panel border-r border-ripple-cyan/20 shrink-0 p-3 flex flex-col justify-between group">
      <div className="flex items-center justify-between">
        <input
          type="text"
          value={track.name}
          onChange={(e) => updateTrack(track.id, { name: e.target.value })}
          className="bg-transparent text-sm font-medium text-ripple-text focus:outline-none focus:ring-1 focus:ring-ripple-cyan rounded px-1 w-32 truncate"
        />
        <button
          onClick={() => deleteTrack(track.id)}
          className="opacity-0 group-hover:opacity-100 p-1 text-ripple-muted hover:text-red-400 transition-opacity"
          title="Delete Track"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="flex items-center space-x-2 mt-2">
        <button
          onClick={handleMute}
          className={`w-8 h-6 rounded text-xs font-bold transition-colors ${
            track.muted ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'bg-ripple-cyan/10 text-ripple-muted hover:bg-ripple-cyan/20 hover:text-ripple-text'
          }`}
        >
          M
        </button>
        <button
          onClick={handleSolo}
          className={`w-8 h-6 rounded text-xs font-bold transition-colors ${
            track.solo ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50' : 'bg-ripple-cyan/10 text-ripple-muted hover:bg-ripple-cyan/20 hover:text-ripple-text'
          }`}
        >
          S
        </button>
      </div>

      <div className="flex items-center space-x-2 mt-2">
        {track.volume === 0 || track.muted ? (
          <VolumeX size={14} className="text-ripple-muted" />
        ) : (
          <Volume2 size={14} className="text-ripple-cyan" />
        )}
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={track.volume}
          onChange={handleVolumeChange}
          className="flex-1 h-1 bg-ripple-cyan/20 rounded-lg appearance-none cursor-pointer accent-ripple-cyan"
        />
      </div>
    </div>
  );
}
