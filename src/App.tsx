import React, { useState, useEffect, useContext, createContext } from 'react';
import logo from './logo.svg';
import './App.css';
import { Manager, Player, defaultManager, useMIDI, MIDIOutputContext, noteOnOff, EventType } from './midi';
import { SingleNote, Accidental } from './Notation';
import { Keyboard } from './Keyboard';
import { unsharpen, unflatten, isKeyBlack } from './notes';
import { quiz, Status, Props } from './Quiz';
import { shuffle, random, choice } from './random';

defaultManager.connect();

const player = new Player(1, defaultManager);
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

const clefs: Clef[] = [
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

function QuestionDisplay({ question, answer }: Props<Question, number[]>) {
    const { note, clef, nextNote, showAsSharp } = question;
    const unalter = showAsSharp ? unsharpen : unflatten;
    const staffLine = unalter(note) - unalter(clef.midiNote);
    const accidental = showAsSharp ? 'accidentalSharp' : 'accidentalFlat';

    function playNote() {
        player.addEvents([
            {
                deltaTick: 0,
                event: {
                    type: EventType.ProgramChange,
                    channel: 0,
                    // program: 25, // Acoustic steel guitar
                    program: 0,
                },
            },
            ...noteOnOff(0, 1, note),
            ...noteOnOff(1, 1, nextNote),
        ]);
    }

    function handleKeyDown(note: number) {
        answer((answer) => [...answer, note]);
    }

    return (
        <div>
            <SingleNote
                accidentalGlyph={isKeyBlack(note) ? accidental : undefined}
                note={clef.line * 2 - staffLine}
                noteGlyph="noteWhole"
                clefGlyph={clef.glyph}
                clefLine={clef.line}
            />

            <div>
                <button onClick={playNote}>Play again</button>
            </div>

            <Keyboard
                lowestMidiNote={clef.lowestMidiNote}
                highestMidiNote={clef.highestMidiNote}
                onKeyDown={handleKeyDown}
            />
        </div>
    )
}

const intervals = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    -1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11, -12
]; // semitones

const Quiz = quiz<Question, number[]>({
    title: 'Interval recognition',
    description: 'Two notes will be played sequentially, with the first note shown on the staff below. Using the configured MIDI input device or the on-screen piano, play both notes.',
    component: QuestionDisplay,
    determineQuestionStatus(question, answer) {
        switch (answer.length) {
            case 0:
                return Status.Unanswered;
            case 1:
                if (answer[0] === question.note) {
                    return Status.PartiallyAnswered;
                }

                return Status.Incorrect;
            case 2:
                if (answer[0] === question.note && answer[1] === question.nextNote) {
                    return Status.Correct;
                }

                return Status.Incorrect;
            default:
                return Status.Incorrect;
        }
    },
    initializeAnswer() {
        return [];
    },
    generateQuestions() {
        shuffle(intervals);

        return intervals.map((interval) => {
            const clef = choice(clefs);
            // TODO: Ensure we have enough notes
            const note = random(clef.lowestMidiNote, clef.highestMidiNote);

            return {
                clef,
                note,
                nextNote: note + interval,
                showAsSharp: choice([true, false]),
            };
        });
    }
});

function Thing() {
    const { manager } = useMIDI();

    // TODO: Render when MIDI error

    return (
        <div>
            <h1>Inputs</h1>
            {manager.inputs().map(port => (
                <div key={port.id}>
                    <label>
                        <input
                            type="radio"
                            name="input"
                            onChange={() => manager.setInput(port)}
                            checked={manager.getInput()?.id === port.id}
                        />
                        {port.name}
                    </label>
                </div>
            ))}

            <h1>Outputs</h1>
            {manager.outputs().map(port => (
                <div key={port.id}>
                    <label>
                        <input
                            type="radio"
                            name="output"
                            onChange={() => manager.setOutput(port)}
                            checked={manager.getOutput()?.id === port.id}
                        />
                        {port.name}
                    </label>
                </div>
            ))}

            <Quiz />
        </div>
    )
}

function App() {
    return (
        <div className="App">
            <Thing />
        </div>
    );
}

export default App;
