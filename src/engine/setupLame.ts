function MPEGMode(ordinal: number) {
    const _ordinal = ordinal;
    (this as any).ordinal = function () {
        return _ordinal;
    }
}

(MPEGMode as any).STEREO = new (MPEGMode as any)(0);
(MPEGMode as any).JOINT_STEREO = new (MPEGMode as any)(1);
(MPEGMode as any).DUAL_CHANNEL = new (MPEGMode as any)(2);
(MPEGMode as any).MONO = new (MPEGMode as any)(3);
(MPEGMode as any).NOT_SET = new (MPEGMode as any)(4);

(self as any).MPEGMode = MPEGMode;
if (typeof window !== 'undefined') {
    (window as any).MPEGMode = MPEGMode;
}
