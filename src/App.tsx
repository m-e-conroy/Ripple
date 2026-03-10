/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import Toolbar from './components/Toolbar';
import ClipLibrary from './components/ClipLibrary';
import Timeline from './components/Timeline';
import AboutModal from './components/AboutModal';
import FXPanel from './components/FXPanel';
import { useAudioStore } from './store/useAudioStore';

export default function App() {
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const { selectedFxTrackId } = useAudioStore();

  return (
    <div className="flex flex-col h-screen bg-ripple-bg text-ripple-text font-sans overflow-hidden">
      <Toolbar onOpenAbout={() => setIsAboutOpen(true)} />
      <div className="flex flex-1 overflow-hidden">
        <ClipLibrary />
        <div className="flex-1 flex flex-col relative overflow-hidden bg-ripple-bg">
          <Timeline />
          {selectedFxTrackId && <FXPanel />}
        </div>
      </div>
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </div>
  );
}
