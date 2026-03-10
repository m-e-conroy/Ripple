import React from 'react';
import { X } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AboutModal({ isOpen, onClose }: AboutModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-ripple-panel border border-ripple-cyan/20 rounded-2xl shadow-2xl shadow-ripple-cyan/10 p-8 w-[400px] max-w-[90vw] relative flex flex-col items-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-ripple-muted hover:text-ripple-cyan transition-colors"
        >
          <X size={24} />
        </button>
        
        <div className="w-48 h-48 mb-6 flex items-center justify-center">
          <img src="/logo.svg" alt="Ripple Logo" className="w-full h-full object-contain" />
        </div>
        
        <h2 className="text-2xl font-bold bg-gradient-to-r from-ripple-cyan to-ripple-purple bg-clip-text text-transparent mb-2">
          Ripple Audio Editor
        </h2>
        <p className="text-ripple-muted text-center mb-6">
          A powerful, browser-based audio editing tool.
        </p>
        
        <div className="text-sm text-ripple-muted/60">
          Version 1.0.0
        </div>
      </div>
    </div>
  );
}
