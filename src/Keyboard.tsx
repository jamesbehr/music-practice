import { useRealtimeMIDI, EventType } from './midi';
import { isKeyBlack } from './notes';

interface KeyboardProps {
    lowestMidiNote: number;
    highestMidiNote: number;
    keyWidth?: number;
    keyHeight?: number;
    onKeyDown?: (note: number) => void;
    onKeyUp?: (note: number) => void;
};

export function Keyboard({ onKeyUp, onKeyDown, lowestMidiNote, highestMidiNote, keyWidth = 20, keyHeight = 100 }: KeyboardProps) {
    const { noteOn, noteOff } = useRealtimeMIDI((event) => {
        if (event.detail.type === EventType.NoteOff) {
            if (onKeyUp) {
                onKeyUp(event.detail.note);
            }
        } else if (event.detail.type === EventType.NoteOn) {
            if (onKeyDown) {
                onKeyDown(event.detail.note);
            }
        }
    });

    if (lowestMidiNote >= highestMidiNote) {
        throw new Error('lowestMidiNote must be < highestMidiNote');
    }

    function keyDown(note: number) {
        noteOn(note);
        if (onKeyDown) {
            onKeyDown(note);
        }
    }

    function keyUp(note: number) {
        noteOff(note);
        if (onKeyUp) {
            onKeyUp(note);
        }
    }

    const whiteWidth = keyWidth;
    const whiteHeight = keyHeight;
    const blackWidth = whiteWidth * 0.6;
    const blackHeight = whiteHeight * 0.65;

    const whiteKeys = [];
    const blackKeys = [];

    const startKey = lowestMidiNote % 12; // Piano starts on C - all C MIDI notes are multiples of 12
    const lastKey = highestMidiNote - lowestMidiNote + startKey;

    let x = 0;
    for (let i = startKey; i <= lastKey; i++) {
        const note = lowestMidiNote + i - startKey;

        if (isKeyBlack(note)) {
            blackKeys.push(
                <rect
                    className="black"
                    key={i}
                    x={x - blackWidth / 2}
                    y={0}
                    width={blackWidth}
                    height={blackHeight}
                    onMouseDown={() => keyDown(note)}
                    onMouseUp={() => keyUp(note)}
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
                    onMouseDown={() => keyDown(note)}
                    onMouseUp={() => keyUp(note)}
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
