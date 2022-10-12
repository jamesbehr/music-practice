import React, { useState, useEffect, useContext, createContext } from 'react';
import logo from './logo.svg';
import './App.css';
import { Midi, Player } from './midi';
import { SingleNote } from './Notation';

const midi = new Midi;
midi.connect();

const player = new Player(1, midi);
player.start();

function playStuff() {
    // player.stop();
    // player.setTempo(1000) // 60 bpm
    player.addEvents([
        {
            deltaTick: 0,
            event: {
                type: 'program-change',
                channel: 0,
                program: 25, // Acoustic steel guitar
            },
        },
        {
            deltaTick: 0,
            event: {
                type: 'note-on',
                note: 60, // Middle C
                channel: 0,
                velocity: 0x7f,
            },
        },
        {
            deltaTick: 1,
            event: {
                type: 'note-off',
                note: 60,
                channel: 0,
                velocity: 0x7f,
            },
        },
        {
            deltaTick: 1,
            event: {
                type: 'note-on',
                note: 64, // E
                channel: 0,
                velocity: 0x7f,
            },
        },
        {
            deltaTick: 2,
            event: {
                type: 'note-off',
                note: 64,
                channel: 0,
                velocity: 0x7f,
            },
        },
        {
            deltaTick: 2,
            event: {
                type: 'note-on',
                note: 67, // G
                channel: 0,
                velocity: 0x7f,
            },
        },
        {
            deltaTick: 3,
            event: {
                type: 'note-off',
                note: 67,
                channel: 0,
                velocity: 0x7f,
            },
        },
    ]);
}

const MIDIOutputContext = createContext<Midi>(midi);

// TODO: Maybe have a separate thing for each output/inputs/state
function useMIDI() {
    const midi = useContext(MIDIOutputContext);

    const [state, forceUpdate] = useState({ instance: midi });

    useEffect(() => {
        function update() {
            forceUpdate({ instance: midi });
        }

        midi.addEventListener('outputs-changed', update);

        return function unsubscribe() {
            midi.removeEventListener('outputs-changed', update);
        };
    });

    return state;
}

function Thing() {
    const { instance: midi } = useMIDI();

    // TODO: Render when error
    // TODO: We need to have some sort of mapping of note names e.g. A, Bb C#, C## => MIDI note numbers
    // { letter: A/B/C/D, semitones: -2/-1/0/1/2, octave: 0/1/2/3/4 }
    // https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/pitch/
    // See names from MusicXml { step: A, alter: -1/0.5, octave: 0 to 9 }

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
                accidentalGlyph="accidentalFlat"
                note={14}
                noteGlyph="noteWhole"
                clefGlyph="gClef"
                clefLine={3}
            />

            <div>
                <button onClick={playStuff}>Test</button>
            </div>
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
