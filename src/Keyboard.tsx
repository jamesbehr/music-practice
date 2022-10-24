import { useCallback } from 'react';
import { classNames } from './classNames';
import { useMIDIOutput, useMIDIInput, MIDIEvent, MIDIEventType, noteOn, noteOff } from './midi';
import { isKeyBlack } from './notes';

interface KeyboardProps {
    lowestMidiNote: number;
    highestMidiNote: number;
    keyWidth?: number;
    keyHeight?: number;
    onKeyDown?: (note: number) => void;
    onKeyUp?: (note: number) => void;
    outputId: string;
    inputId: string;
    highlightedNotes?: { [note: number]: string };
}

export function Keyboard({
    inputId,
    outputId,
    onKeyUp,
    onKeyDown,
    lowestMidiNote,
    highestMidiNote,
    keyWidth = 25,
    keyHeight = 120,
    highlightedNotes = {},
}: KeyboardProps) {
    const handler = useCallback(
        (event: MIDIEvent) => {
            if (event.type === MIDIEventType.NoteOff) {
                if (onKeyUp) {
                    onKeyUp(event.note);
                }
            } else if (event.type === MIDIEventType.NoteOn) {
                if (onKeyDown) {
                    onKeyDown(event.note);
                }
            }
        },
        [onKeyUp, onKeyDown],
    );

    useMIDIInput(inputId, handler);
    const output = useMIDIOutput(outputId, 1);

    if (lowestMidiNote >= highestMidiNote) {
        throw new Error('lowestMidiNote must be < highestMidiNote');
    }

    function keyDown(note: number) {
        output.sendEvent(noteOn(note));
        if (onKeyDown) {
            onKeyDown(note);
        }
    }

    function keyUp(note: number) {
        output.sendEvent(noteOff(note));
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
            const highlight = highlightedNotes[note] || 'fill-slate-900 hover:fill-slate-700';

            blackKeys.push(
                <rect
                    className={classNames(highlight, 'transition ease-in duration-100 stroke-slate-900')}
                    key={i}
                    x={x - blackWidth / 2}
                    y={0}
                    width={blackWidth}
                    height={blackHeight}
                    onMouseDown={() => keyDown(note)}
                    onMouseUp={() => keyUp(note)}
                />,
            );
        } else {
            const highlight = highlightedNotes[note] || 'fill-white hover:fill-slate-200';

            whiteKeys.push(
                <rect
                    className={classNames(highlight, 'transition ease-in duration-100 stroke-slate-900')}
                    key={i}
                    x={x}
                    y={0}
                    width={whiteWidth}
                    height={whiteHeight}
                    onMouseDown={() => keyDown(note)}
                    onMouseUp={() => keyUp(note)}
                />,
            );

            x += whiteWidth;
        }
    }

    return (
        <svg width={x} height={keyHeight}>
            {whiteKeys}
            {blackKeys}
        </svg>
    );
}
