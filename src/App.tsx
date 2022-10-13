import React, { useState, useEffect, useContext, createContext } from 'react';
import logo from './logo.svg';
import './App.css';
import { Midi, Player, useMIDI, MIDIOutputContext } from './midi';
import { SingleNote, Accidental } from './Notation';
import { Keyboard } from './Keyboard';
import { unsharpen, unflatten, isKeyBlack } from './notes';

const midi = new Midi;
midi.connect();

const player = new Player(1, midi);
player.start();


function Thing() {
    const { instance: midi } = useMIDI();

    // TODO: Render when MIDI error

    // const note = 81; // A5
    const note = 66;
    const clefNote = 67; // G above middle C
    const clefLine = 3;
    const interval = 1; // semitones

    const isSharp = false;
    const unalter = isSharp ? unsharpen : unflatten;
    const staffLine = unalter(note) - unalter(clefNote);
    const accidental = isSharp ? 'accidentalSharp' : 'accidentalFlat';

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
                    note: note,
                    channel: 0,
                    velocity: 0x7f,
                },
            },
            {
                deltaTick: 1,
                event: {
                    type: 'note-off',
                    note: note,
                    channel: 0,
                    velocity: 0x7f,
                },
            },
            {
                deltaTick: 1,
                event: {
                    type: 'note-on',
                    note: note + interval,
                    channel: 0,
                    velocity: 0x7f,
                },
            },
            {
                deltaTick: 2,
                event: {
                    type: 'note-off',
                    note: note + interval,
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
                accidentalGlyph={isKeyBlack(note) ? accidental : undefined}
                note={clefLine*2 - staffLine}
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
