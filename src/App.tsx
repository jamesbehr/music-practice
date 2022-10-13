import React, { useState, useEffect, useContext, createContext } from 'react';
import logo from './logo.svg';
import './App.css';
import { Midi, Player, useMIDI, MIDIOutputContext } from './midi';
import { SingleNote, Accidental } from './Notation';
import { Keyboard } from './Keyboard';

const midi = new Midi;
midi.connect();

const player = new Player(1, midi);
player.start();

enum Step {
    C = 0,
    D,
    E,
    F,
    G,
    A,
    B,
};

// Pitch is represented as a combination of the step of the diatonic scale, the
// chromatic alteration, and the octave.
interface Pitch {
    // Step of the diatonic scale;
    step: Step;

    // The chromatic alteration in number of semitones (e.g., -1 for flat, 1
    // for sharp). Decimal values like 0.5 (quarter tone sharp) are used for
    // microtones.
    alter: number;

    // Octaves are represented by the numbers 0 to 9, where 4 indicates the
    // octave started by middle C.
    octave: number;
};

const semitonesAboveC = {
    [Step.C]: 0,
    [Step.D]: 2,
    [Step.E]: 4,
    [Step.F]: 5,
    [Step.G]: 7,
    [Step.A]: 9,
    [Step.B]: 11,
}

function pitchToMidiNote(pitch: Pitch): number {
    const cInSameOctave = (pitch.octave + 1) * 12;
    return cInSameOctave + semitonesAboveC[pitch.step] + Math.round(pitch.alter);

    // TODO: Bounds checking 0 <= note <= 127
}

// Number or lines or spaces there are between a given note and a reference pitch
function staffNotesAbove(note: Pitch, reference: Pitch): number {
    const stepDiff = note.step - reference.step;
    const octaveDiff = note.octave - reference.octave;
    // TODO: Factor in the alter
    return stepDiff + octaveDiff * 7;
}

const accidentalsByAlter = new Map<number, Accidental> ([
    [-1, 'accidentalFlat'],
    [1, 'accidentalSharp'],
]);

function Thing() {
    const { instance: midi } = useMIDI();

    // TODO: Render when MIDI error

    const note = {
        step: Step.F,
        octave: 4,
        alter: 0,
    };

    const clefNote = {
        step: Step.G,
        octave: 4,
        alter: 0,
    };

    const interval = 1; // semitones

    const clefLine = 3;
    const accidental = accidentalsByAlter.get(note.alter);

    // TODO: Octave range
    // Bass Clef (F3) => C2 - C4 is comfortable
    // Trebble Clef (G4) => C4 - C6 is comfortable
    //
    // Algorithm
    // - Define a range of pitches by Clef you want to train
    // - Pick a random note and interval above/below it that falls somewhere in any clef's range
    // - If the note fits in more than one clef's range, randomly select a clef.
    // - Show random note on the staff with the chosen clef
    // - Play that MIDI note and the interval (have a button to replay)
    // - ...

    function playNote() {
        const midiNote = pitchToMidiNote(note);

        // TODO: Clear anything that is currently being played
        player.addEvents([
            {
                deltaTick: 0,
                event: {
                    type: 'program-change',
                    channel: 0,
                    // program: 25, // Acoustic steel guitar
                    program: 0, // Acoustic steel guitar
                },
            },
            {
                deltaTick: 0,
                event: {
                    type: 'note-on',
                    note: midiNote,
                    channel: 0,
                    velocity: 0x7f,
                },
            },
            {
                deltaTick: 1,
                event: {
                    type: 'note-off',
                    note: midiNote,
                    channel: 0,
                    velocity: 0x7f,
                },
            },
            {
                deltaTick: 1,
                event: {
                    type: 'note-on',
                    note: midiNote + interval,
                    channel: 0,
                    velocity: 0x7f,
                },
            },
            {
                deltaTick: 2,
                event: {
                    type: 'note-off',
                    note: midiNote + interval,
                    channel: 0,
                    velocity: 0x7f,
                },
            },
        ]);
    }

    return (
        <div>
            <h1>Inputs</h1>

            <h1>Outputs</h1>
            {midi.outputs().map(port => (
                <div key={port.id}>
                    <label>
                        <input
                            type="radio"
                            name="output"
                            onChange={() => midi.setOutput(port)}
                            checked={midi.output !== null && midi.output.id === port.id}
                            />
                        {port.name}
                    </label>
                </div>
            ))}

            <SingleNote
                accidentalGlyph={accidental}
                note={clefLine*2 - staffNotesAbove(note, clefNote)}
                noteGlyph="noteWhole"
                clefGlyph="gClef"
                clefLine={clefLine}
            />

            <div>
                <button onClick={playNote}>Test</button>
            </div>

            <Keyboard lowestMidiNote={60} highestMidiNote={72} />
        </div>
    )
}

function App() {
    return (
        <div className="App">
            <MIDIOutputContext.Provider value={midi}>
                <Thing />
            </MIDIOutputContext.Provider>
        </div>
    );
}

export default App;
