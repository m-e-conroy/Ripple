import React, { useEffect, useRef } from 'react';
import { Track } from '../store/useAudioStore';
import RegionComponent from './Region';
import interact from 'interactjs';

interface Props {
  track: Track;
  pixelsPerSecond: number;
}

export default function TrackLane({ track, pixelsPerSecond }: Props) {
  const laneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = laneRef.current;
    if (!el) return;

    interact(el).dropzone({
      accept: '.region-draggable',
      overlap: 0.5,
      ondrop: function (event) {
        const draggableElement = event.relatedTarget;
        draggableElement.setAttribute('data-drop-track-id', track.id);
      }
    });

    return () => {
      interact(el).unset();
    };
  }, [track.id]);

  return (
    <div ref={laneRef} className="relative w-full h-full">
      {track.regions.map((region) => (
        <RegionComponent
          key={region.id}
          region={region}
          pixelsPerSecond={pixelsPerSecond}
        />
      ))}
    </div>
  );
}
