const unflattenMap = [
    0, // C
    1, // Db
    1, // D
    2, // Eb
    2, // E
    3, // F
    4, // Gb
    4, // G
    5, // Ab
    5, // A
    6, // Bb
    6, // B
];

const unsharpenMap = [
    0, // C
    0, // C#
    1, // D
    1, // D#
    2, // E
    3, // F
    3, // F#
    4, // G
    4, // G#
    5, // A
    5, // A#
    6, // B
];

export function unsharpen(midiNote: number): number {
    const octave = Math.floor(midiNote / 12);
    return unsharpenMap[midiNote % 12] + octave*7;
}

export function unflatten(midiNote: number): number {
    const octave = Math.floor(midiNote / 12);
    return unflattenMap[midiNote % 12] + octave*7;
}

const blackKeyMap = [
    false, // C
    true,  // C#
    false, // D
    true,  // D#
    false, // E
    false, // F
    true,  // F#
    false, // G
    true,  // G#
    false, // A
    true,  // A#
    false, // B
];

export function isKeyBlack(midiNote: number): boolean {
    return blackKeyMap[midiNote % 12];
}
