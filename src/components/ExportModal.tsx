import React, { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectDuration: number;
  onExport: (format: 'wav' | 'mp3', customDuration?: number) => void;
}

export default function ExportModal({ isOpen, onClose, projectDuration, onExport }: ExportModalProps) {
  const [useCustomDuration, setUseCustomDuration] = useState(false);
  const [customDuration, setCustomDuration] = useState<string>(projectDuration.toFixed(2));

  // Update custom duration if project duration changes and we're not using custom
  useEffect(() => {
    if (!useCustomDuration) {
      setCustomDuration(projectDuration.toFixed(2));
    }
  }, [projectDuration, useCustomDuration]);

  if (!isOpen) return null;

  const handleExport = (format: 'wav' | 'mp3') => {
    let durationToUse: number | undefined = undefined;
    
    if (useCustomDuration) {
      const parsed = parseFloat(customDuration);
      if (!isNaN(parsed) && parsed > 0) {
        durationToUse = parsed;
      }
    }
    
    onExport(format, durationToUse);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-ripple-panel border border-ripple-cyan/20 rounded-2xl shadow-2xl shadow-ripple-cyan/10 p-6 w-[400px] max-w-[90vw] relative flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-ripple-muted hover:text-ripple-cyan transition-colors"
        >
          <X size={20} />
        </button>
        
        <h2 className="text-xl font-bold text-ripple-text mb-6">
          Export Audio
        </h2>
        
        <div className="space-y-4 mb-8">
          <div className="flex justify-between items-center text-sm">
            <span className="text-ripple-muted">Calculated Project Length:</span>
            <span className="font-mono text-ripple-text">{projectDuration.toFixed(2)}s</span>
          </div>
          
          <div className="flex items-center space-x-2 pt-2 border-t border-ripple-cyan/10">
            <input 
              type="checkbox" 
              id="custom-duration-toggle"
              checked={useCustomDuration}
              onChange={(e) => setUseCustomDuration(e.target.checked)}
              className="rounded border-ripple-cyan/30 bg-ripple-bg text-ripple-cyan focus:ring-ripple-cyan/50"
            />
            <label htmlFor="custom-duration-toggle" className="text-sm text-ripple-text cursor-pointer">
              Use custom export length
            </label>
          </div>
          
          {useCustomDuration && (
            <div className="flex items-center space-x-2 pl-6">
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={customDuration}
                onChange={(e) => setCustomDuration(e.target.value)}
                className="w-24 bg-ripple-bg border border-ripple-cyan/30 rounded px-2 py-1 text-sm text-ripple-text focus:outline-none focus:border-ripple-cyan"
              />
              <span className="text-sm text-ripple-muted">seconds</span>
            </div>
          )}
          
          {useCustomDuration && (
            <p className="text-xs text-ripple-muted pl-6 italic">
              * If shorter than project, audio will be cut off. If longer, silence will be added.
            </p>
          )}
        </div>
        
        <div className="flex space-x-3 justify-end">
          <button
            onClick={() => handleExport('wav')}
            className="flex items-center space-x-2 px-4 py-2 bg-ripple-panel border border-ripple-cyan/30 hover:bg-ripple-cyan/10 text-ripple-text rounded font-medium transition-colors text-sm"
          >
            <Download size={16} />
            <span>Export WAV</span>
          </button>
          <button
            onClick={() => handleExport('mp3')}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-ripple-cyan to-ripple-purple hover:opacity-90 text-white rounded font-medium transition-opacity text-sm"
          >
            <Download size={16} />
            <span>Export MP3</span>
          </button>
        </div>
      </div>
    </div>
  );
}
