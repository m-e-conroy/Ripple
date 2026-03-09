/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import Toolbar from './components/Toolbar';
import ClipLibrary from './components/ClipLibrary';
import Timeline from './components/Timeline';

export default function App() {
  return (
    <div className="flex flex-col h-screen bg-zinc-900 text-zinc-100 font-sans overflow-hidden">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <ClipLibrary />
        <div className="flex-1 flex flex-col relative overflow-hidden bg-zinc-950">
          <Timeline />
        </div>
      </div>
    </div>
  );
}
