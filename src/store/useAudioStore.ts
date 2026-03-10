import { create } from 'zustand';
import { temporal } from 'zundo';
import { v4 as uuidv4 } from 'uuid';

export interface AudioClip {
  id: string;
  filename: string;
  buffer: AudioBuffer;
  duration: number;
}

export interface Region {
  id: string;
  trackId: string;
  sourceClipId: string;
  startTime: number;
  clipOffset: number;
  duration: number;
}

export interface TrackFX {
  eq: { low: number; mid: number; high: number; enabled: boolean };
  delay: { time: number; feedback: number; mix: number; enabled: boolean };
  reverb: { decay: number; mix: number; enabled: boolean };
}

export interface Track {
  id: string;
  name: string;
  volume: number; // 0.0 - 1.0
  muted: boolean;
  solo: boolean;
  regions: Region[];
  fx: TrackFX;
}

export interface AudioState {
  projectId: string;
  projectName: string;
  sampleRate: number;
  bpm: number;
  tracks: Track[];
  clips: Record<string, AudioClip>;
  playheadPosition: number;
  isPlaying: boolean;
  clipboard: Region | null;
  selectedRegionId: string | null;
  selectedFxTrackId: string | null;
  duration: number;
  pixelsPerSecond: number;

  // Actions
  addClip: (clip: AudioClip) => void;
  addTrack: () => void;
  updateTrack: (id: string, updates: Partial<Track>) => void;
  updateTrackFX: (id: string, fxUpdates: Partial<TrackFX>) => void;
  deleteTrack: (id: string) => void;
  addRegion: (trackId: string, region: Omit<Region, 'id' | 'trackId'>) => void;
  updateRegion: (id: string, updates: Partial<Region>) => void;
  deleteRegion: (id: string) => void;
  setPlayheadPosition: (pos: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  selectRegion: (id: string | null) => void;
  setSelectedFxTrack: (id: string | null) => void;
  copyRegion: () => void;
  pasteRegion: () => void;
  splitRegion: () => void;
  setDuration: (duration: number) => void;
  setPixelsPerSecond: (pixels: number) => void;
}

const defaultFX: TrackFX = {
  eq: { low: 0, mid: 0, high: 0, enabled: false },
  delay: { time: 0.3, feedback: 0.4, mix: 0.3, enabled: false },
  reverb: { decay: 2.0, mix: 0.3, enabled: false },
};

export const useAudioStore = create<AudioState>()(
  temporal(
    (set, get) => ({
      projectId: uuidv4(),
      projectName: 'Untitled Project',
      sampleRate: 44100,
      bpm: 120,
      tracks: [
        {
          id: uuidv4(),
          name: 'Track 1',
          volume: 0.8,
          muted: false,
          solo: false,
          regions: [],
          fx: { ...defaultFX },
        },
      ],
      clips: {},
      playheadPosition: 0,
      isPlaying: false,
      clipboard: null,
      selectedRegionId: null,
      selectedFxTrackId: null,
      duration: 60, // Default 60 seconds timeline
      pixelsPerSecond: 50,

      addClip: (clip) =>
        set((state) => ({ clips: { ...state.clips, [clip.id]: clip } })),

      addTrack: () =>
        set((state) => ({
          tracks: [
            ...state.tracks,
            {
              id: uuidv4(),
              name: `Track ${state.tracks.length + 1}`,
              volume: 0.8,
              muted: false,
              solo: false,
              regions: [],
              fx: { ...defaultFX },
            },
          ],
        })),

      updateTrack: (id, updates) =>
        set((state) => ({
          tracks: state.tracks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        })),

      updateTrackFX: (id, fxUpdates) =>
        set((state) => ({
          tracks: state.tracks.map((t) =>
            t.id === id ? { ...t, fx: { ...t.fx, ...fxUpdates } } : t
          ),
        })),

      deleteTrack: (id) =>
        set((state) => ({
          tracks: state.tracks.filter((t) => t.id !== id),
          selectedFxTrackId: state.selectedFxTrackId === id ? null : state.selectedFxTrackId,
        })),

      addRegion: (trackId, region) =>
        set((state) => ({
          tracks: state.tracks.map((t) =>
            t.id === trackId
              ? { ...t, regions: [...t.regions, { ...region, id: uuidv4(), trackId }] }
              : t
          ),
        })),

      updateRegion: (id, updates) =>
        set((state) => {
          let regionToMove: Region | null = null;
          let oldTrackId: string | null = null;

          // Check if we are changing the trackId
          if (updates.trackId) {
            for (const t of state.tracks) {
              const r = t.regions.find((r) => r.id === id);
              if (r && r.trackId !== updates.trackId) {
                regionToMove = { ...r, ...updates };
                oldTrackId = t.id;
                break;
              }
            }
          }

          if (regionToMove && oldTrackId) {
            return {
              tracks: state.tracks.map((t) => {
                if (t.id === oldTrackId) {
                  return { ...t, regions: t.regions.filter((r) => r.id !== id) };
                }
                if (t.id === updates.trackId) {
                  return { ...t, regions: [...t.regions, regionToMove!] };
                }
                return t;
              }),
            };
          }

          return {
            tracks: state.tracks.map((t) => ({
              ...t,
              regions: t.regions.map((r) => (r.id === id ? { ...r, ...updates } : r)),
            })),
          };
        }),

      deleteRegion: (id) =>
        set((state) => ({
          tracks: state.tracks.map((t) => ({
            ...t,
            regions: t.regions.filter((r) => r.id !== id),
          })),
          selectedRegionId: state.selectedRegionId === id ? null : state.selectedRegionId,
        })),

      setPlayheadPosition: (pos) => set({ playheadPosition: Math.max(0, pos) }),

      setIsPlaying: (isPlaying) => set({ isPlaying }),

      selectRegion: (id) => set({ selectedRegionId: id }),

      setSelectedFxTrack: (id) => set({ selectedFxTrackId: id }),

      copyRegion: () => {
        const { tracks, selectedRegionId } = get();
        if (!selectedRegionId) return;

        for (const track of tracks) {
          const region = track.regions.find((r) => r.id === selectedRegionId);
          if (region) {
            set({ clipboard: region });
            return;
          }
        }
      },

      pasteRegion: () => {
        const { clipboard, tracks, playheadPosition } = get();
        if (!clipboard || tracks.length === 0) return;

        // Paste to the track of the clipboard, or the first track if not found
        let targetTrackId = clipboard.trackId;
        if (!tracks.find((t) => t.id === targetTrackId)) {
          targetTrackId = tracks[0].id;
        }

        set((state) => ({
          tracks: state.tracks.map((t) =>
            t.id === targetTrackId
              ? {
                  ...t,
                  regions: [
                    ...t.regions,
                    {
                      ...clipboard,
                      id: uuidv4(),
                      trackId: targetTrackId,
                      startTime: playheadPosition,
                    },
                  ],
                }
              : t
          ),
        }));
      },

      splitRegion: () => {
        const { tracks, selectedRegionId, playheadPosition } = get();
        if (!selectedRegionId) return;

        set((state) => {
          const newTracks = state.tracks.map((t) => {
            const regionIndex = t.regions.findIndex((r) => r.id === selectedRegionId);
            if (regionIndex === -1) return t;

            const region = t.regions[regionIndex];
            
            // Check if playhead is within the region
            if (playheadPosition <= region.startTime || playheadPosition >= region.startTime + region.duration) {
              return t;
            }

            const splitPoint = playheadPosition - region.startTime;
            
            const region1: Region = {
              ...region,
              duration: splitPoint,
            };
            
            const region2: Region = {
              ...region,
              id: uuidv4(),
              startTime: playheadPosition,
              clipOffset: region.clipOffset + splitPoint,
              duration: region.duration - splitPoint,
            };

            const newRegions = [...t.regions];
            newRegions.splice(regionIndex, 1, region1, region2);

            return { ...t, regions: newRegions };
          });

          return { tracks: newTracks };
        });
      },

      setDuration: (duration) => set({ duration }),
      setPixelsPerSecond: (pixels) => set({ pixelsPerSecond: Math.max(10, Math.min(500, pixels)) }),
    }),
    {
      partialize: (state) => {
        // Don't save playhead position or isPlaying state in history
        const { playheadPosition, isPlaying, ...rest } = state;
        return rest;
      },
    }
  )
);
