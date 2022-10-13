import { useMIDI } from './midi';
import { isKeyBlack } from './notes';

interface KeyboardProps {
    lowestMidiNote: number;
    highestMidiNote: number;
    keyWidth?: number;
    keyHeight?: number;
};

export function Keyboard({ lowestMidiNote, highestMidiNote, keyWidth = 20, keyHeight = 100 }: KeyboardProps) {
    const { instance: midi } = useMIDI();

    if (lowestMidiNote >= highestMidiNote) {
        throw new Error('lowestMidiNote must be < highestMidiNote');
    }

    const whiteWidth = keyWidth;
    const whiteHeight = keyHeight;
    const blackWidth = whiteWidth * 0.6;
    const blackHeight = whiteHeight * 0.65;

    const whiteKeys = [];
    const blackKeys = [];

    const startKey = lowestMidiNote % 12; // Piano starts on C - all C MIDI notes are multiples of 12
    const lastKey = highestMidiNote - lowestMidiNote + startKey;

    function noteDown(note: number) {
        midi.playEvent({
            type: 'note-on',
            note: note,
            channel: 0,
            velocity: 0x7f,
        });
    }

    function noteUp(note: number) {
        midi.playEvent({
            type: 'note-off',
            note: note,
            channel: 0,
            velocity: 0x7f,
        });
    }

    let x = 0;
    for (let i = startKey; i < lastKey; i++) {
        const note = lowestMidiNote + i - startKey;

        if (isKeyBlack(note)) {
            blackKeys.push(
                <rect
                    className="black"
                    key={i}
                    x={x - blackWidth/2}
                    y={0}
                    width={blackWidth}
                    height={blackHeight}
                    onMouseDown={() => noteDown(note)}
                    onMouseUp={() => noteUp(note)}
                />
            );
        } else {
            whiteKeys.push(
                <rect
                    className="white"
                    key={i}
                    x={x}
                    y={0}
                    width={whiteWidth}
                    height={whiteHeight}
                    onMouseDown={() => noteDown(note)}
                    onMouseUp={() => noteUp(note)}
                />
            );

            x += whiteWidth;
        }
    }

    return (
        <svg className="Keyboard" width={x} height={keyHeight}>
            {whiteKeys}
            {blackKeys}
        </svg>
    );
}
