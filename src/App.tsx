import React, { useState, useEffect, useContext, createContext } from 'react';
import logo from './logo.svg';
import './App.css';
import { Midi, Player, useMIDI, MIDIOutputContext, noteOnOff } from './midi';
import { SingleNote, Accidental } from './Notation';
import { Keyboard } from './Keyboard';
import { unsharpen, unflatten, isKeyBlack } from './notes';

const midi = new Midi;
midi.connect();

const player = new Player(1, midi);
player.start();

interface Clef {
    glyph: 'gClef' | 'fClef';
    line: number;
    midiNote: number;
    lowestMidiNote: number;
    highestMidiNote: number;
}

interface Question {
    clef: Clef;
    showAsSharp: boolean;
    note: number;
    nextNote: number;
};

const clefs : Clef[] = [
    {
        glyph: 'gClef',
        line: 3,
        midiNote: 67, // G4
        lowestMidiNote: 60, // C4
        highestMidiNote: 84, // C6
    },
    {
        glyph: 'fClef',
        line: 1,
        midiNote: 53, // F3
        lowestMidiNote: 36, // C2
        highestMidiNote: 60, // C4
    },
];

const intervals = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    -1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11, -12
]; // semitones

const questions : Question[] = [];
clefs.forEach((clef) => {
    for (let note = clef.lowestMidiNote; note < clef.highestMidiNote; note++) {
        intervals.forEach((interval) => {
            const nextNote = note + interval;

            if (clef.lowestMidiNote <= nextNote && nextNote <= clef.highestMidiNote) {
                // There are two ways of reading this note
                if (isKeyBlack(note)) {
                    questions.push({ clef, note, nextNote, showAsSharp: false });
                }

                // The accidental here won't matter if the note isn't sharp
                questions.push({ clef, note, nextNote, showAsSharp: true });
            }
        });
    }
});

function QuestionDisplay({ note, clef, nextNote, showAsSharp }: Question) {
    const { instance: midi } = useMIDI();

    const unalter = showAsSharp ? unsharpen : unflatten;
    const staffLine = unalter(note) - unalter(clef.midiNote);
    const accidental = showAsSharp ? 'accidentalSharp' : 'accidentalFlat';

    function playNote() {
        // TODO: Clear anything that is currently being played
        player.addEvents([
            {
                deltaTick: 0,
                event: {
                    type: 'program-change',
                    channel: 0,
                    // program: 25, // Acoustic steel guitar
                    program: 0,
                },
            },
            ...noteOnOff(0, 1, note),
            ...noteOnOff(1, 1, nextNote),
        ]);
    }

    return (
        <div>
            <SingleNote
                accidentalGlyph={isKeyBlack(note) ? accidental : undefined}
                note={clef.line*2 - staffLine}
                noteGlyph="noteWhole"
                clefGlyph={clef.glyph}
                clefLine={clef.line}
            />

            <div>
                <button onClick={playNote}>Test</button>
            </div>

            <Keyboard lowestMidiNote={clef.lowestMidiNote} highestMidiNote={clef.highestMidiNote} />
        </div>
    )
}

function Thing() {
    const { instance: midi } = useMIDI();

    // TODO: Render when MIDI error

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

            <QuestionDisplay {...questions[678] } />
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
