import React, { useEffect } from 'react';
import { useAudioStore, TrackFX } from '../store/useAudioStore';
import { engine } from '../engine/AudioEngine';
import { X, Power } from 'lucide-react';

export default function FXPanel() {
  const { tracks, selectedFxTrackId, setSelectedFxTrack, updateTrackFX } = useAudioStore();
  
  const track = tracks.find(t => t.id === selectedFxTrackId);

  // Update engine when FX changes
  useEffect(() => {
    if (track) {
      engine.updateTrackFX(track.id, track.fx);
    }
  }, [track?.fx, track?.id]);

  if (!track) return null;

  const fx = track.fx;

  const handleUpdate = (type: keyof TrackFX, updates: any) => {
    updateTrackFX(track.id, {
      [type]: { ...fx[type], ...updates }
    });
  };

  return (
    <div className="h-64 bg-ripple-panel border-t border-ripple-cyan/20 shrink-0 flex flex-col shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-40 relative">
      <div className="flex items-center justify-between px-4 py-2 border-b border-ripple-cyan/10 bg-ripple-bg/50">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-ripple-cyan tracking-wide">FX CHAIN</span>
          <span className="text-ripple-muted text-sm px-2 py-0.5 bg-ripple-panel rounded border border-ripple-cyan/20">
            {track.name}
          </span>
        </div>
        <button 
          onClick={() => setSelectedFxTrack(null)}
          className="text-ripple-muted hover:text-ripple-cyan transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 flex overflow-x-auto p-4 space-x-6">
        
        {/* EQ Section */}
        <div className={`flex flex-col w-64 shrink-0 border rounded-lg p-3 transition-colors h-full ${fx.eq.enabled ? 'border-ripple-cyan/50 bg-ripple-cyan/5' : 'border-ripple-cyan/10 bg-ripple-bg/30'}`}>
          <div className="flex items-center justify-between mb-4 shrink-0">
            <span className={`font-semibold ${fx.eq.enabled ? 'text-ripple-text' : 'text-ripple-muted'}`}>3-Band EQ</span>
            <button 
              onClick={() => handleUpdate('eq', { enabled: !fx.eq.enabled })}
              className={`p-1 rounded-full transition-colors ${fx.eq.enabled ? 'text-ripple-cyan bg-ripple-cyan/20' : 'text-ripple-muted hover:text-ripple-text'}`}
            >
              <Power size={14} />
            </button>
          </div>
          
          <div className="flex justify-between flex-1 px-2 min-h-0">
            <Slider label="LOW" value={fx.eq.low} min={-24} max={24} step={1} onChange={(v) => handleUpdate('eq', { low: v })} disabled={!fx.eq.enabled} />
            <Slider label="MID" value={fx.eq.mid} min={-24} max={24} step={1} onChange={(v) => handleUpdate('eq', { mid: v })} disabled={!fx.eq.enabled} />
            <Slider label="HIGH" value={fx.eq.high} min={-24} max={24} step={1} onChange={(v) => handleUpdate('eq', { high: v })} disabled={!fx.eq.enabled} />
          </div>
        </div>

        {/* Delay Section */}
        <div className={`flex flex-col w-64 shrink-0 border rounded-lg p-3 transition-colors h-full ${fx.delay.enabled ? 'border-ripple-purple/50 bg-ripple-purple/5' : 'border-ripple-cyan/10 bg-ripple-bg/30'}`}>
          <div className="flex items-center justify-between mb-4 shrink-0">
            <span className={`font-semibold ${fx.delay.enabled ? 'text-ripple-text' : 'text-ripple-muted'}`}>Delay</span>
            <button 
              onClick={() => handleUpdate('delay', { enabled: !fx.delay.enabled })}
              className={`p-1 rounded-full transition-colors ${fx.delay.enabled ? 'text-ripple-purple bg-ripple-purple/20' : 'text-ripple-muted hover:text-ripple-text'}`}
            >
              <Power size={14} />
            </button>
          </div>
          
          <div className="flex justify-between flex-1 px-2 min-h-0">
            <Slider label="TIME" value={fx.delay.time} min={0.01} max={2.0} step={0.01} onChange={(v) => handleUpdate('delay', { time: v })} disabled={!fx.delay.enabled} format={(v) => `${v.toFixed(2)}s`} />
            <Slider label="FDBK" value={fx.delay.feedback} min={0} max={0.95} step={0.01} onChange={(v) => handleUpdate('delay', { feedback: v })} disabled={!fx.delay.enabled} format={(v) => `${Math.round(v*100)}%`} />
            <Slider label="MIX" value={fx.delay.mix} min={0} max={1} step={0.01} onChange={(v) => handleUpdate('delay', { mix: v })} disabled={!fx.delay.enabled} format={(v) => `${Math.round(v*100)}%`} />
          </div>
        </div>

        {/* Reverb Section */}
        <div className={`flex flex-col w-48 shrink-0 border rounded-lg p-3 transition-colors h-full ${fx.reverb.enabled ? 'border-ripple-pink/50 bg-ripple-pink/5' : 'border-ripple-cyan/10 bg-ripple-bg/30'}`}>
          <div className="flex items-center justify-between mb-4 shrink-0">
            <span className={`font-semibold ${fx.reverb.enabled ? 'text-ripple-text' : 'text-ripple-muted'}`}>Reverb</span>
            <button 
              onClick={() => handleUpdate('reverb', { enabled: !fx.reverb.enabled })}
              className={`p-1 rounded-full transition-colors ${fx.reverb.enabled ? 'text-ripple-pink bg-ripple-pink/20' : 'text-ripple-muted hover:text-ripple-text'}`}
            >
              <Power size={14} />
            </button>
          </div>
          
          <div className="flex justify-around flex-1 px-2 min-h-0">
            <Slider label="DECAY" value={fx.reverb.decay} min={0.1} max={10.0} step={0.1} onChange={(v) => handleUpdate('reverb', { decay: v })} disabled={!fx.reverb.enabled} format={(v) => `${v.toFixed(1)}s`} />
            <Slider label="MIX" value={fx.reverb.mix} min={0} max={1} step={0.01} onChange={(v) => handleUpdate('reverb', { mix: v })} disabled={!fx.reverb.enabled} format={(v) => `${Math.round(v*100)}%`} />
          </div>
        </div>

      </div>
    </div>
  );
}

// Helper Slider Component for vertical sliders
function Slider({ label, value, min, max, step, onChange, disabled, format }: any) {
  const displayValue = format ? format(value) : (value > 0 ? `+${value}` : value);
  
  return (
    <div className={`flex flex-col items-center h-full min-h-0 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <span className="text-[10px] text-ripple-muted font-mono mb-2 shrink-0">{displayValue}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="vertical-slider flex-1 min-h-0 w-1.5 bg-ripple-bg rounded-lg appearance-none cursor-pointer outline-none"
        style={{ WebkitAppearance: 'slider-vertical' }}
      />
      <span className="text-[10px] font-bold mt-2 text-ripple-text tracking-wider shrink-0">{label}</span>
    </div>
  );
}
