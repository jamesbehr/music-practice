import './App.css';
import { Player, defaultManager, useMIDI, noteOnOff, EventType } from './midi';
import { SingleNote } from './Notation';
import { Keyboard } from './Keyboard';
import { unsharpen, unflatten, isKeyBlack } from './notes';
import { quiz, Status, Props, SettingProps } from './Quiz';
import { shuffle, random, choice } from './random';

defaultManager.connect();

const player = new Player(1, defaultManager);
player.start();

interface Clef {
    glyph: 'gClef' | 'fClef';
    line: number;
    midiNote: number;
}

interface ClefSettings {
    clef: Clef;
    enabled: boolean;
    lowestMidiNote: number;
    highestMidiNote: number;
}

interface Settings {
    clefs: {
        trebleClef: ClefSettings;
        bassClef: ClefSettings;
    }
}

const clefNames: (keyof Settings['clefs'])[] = ['trebleClef', 'bassClef'];

interface Question {
    showAsSharp: boolean;
    note: number;
    nextNote: number;
    clefName: keyof Settings['clefs'];

    // MIDI Program to play the notes through
    program: number;
};

// TODO: Show both lowest and highest notes
// TODO: Set notes from MIDI instruments
function SingleClefSettings({ value, onChange }: SettingProps<ClefSettings>) {
    const note = value.lowestMidiNote;
    const { lowestMidiNote, highestMidiNote, clef, enabled } = value;
    const staffLine = unsharpen(note) - unsharpen(clef.midiNote);

    return (
        <div>
            <SingleNote
                accidentalGlyph={isKeyBlack(note) ? 'accidentalSharp' : undefined}
                note={clef.line * 2 - staffLine}
                noteGlyph="noteWhole"
                clefGlyph={clef.glyph}
                clefLine={clef.line}
            />
            <label>
                <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => onChange({ ...value, enabled: !enabled })}
                />
                Enabled
            </label>
            <label>
                <input
                    type="number"
                    value={lowestMidiNote}
                    onChange={(e) => onChange({ ...value, lowestMidiNote: parseInt(e.target.value, 10) })}
                />
                Lowest note
            </label>
            <label>
                <input
                    type="number"
                    value={highestMidiNote}
                    onChange={(e) => onChange({ ...value, highestMidiNote: parseInt(e.target.value, 10) })}
                />
                Highest note
            </label>
        </div>
    );
}

function QuestionDisplay({ question, answer, settings }: Props<Question, number[], Settings>) {
    const { clefName, note, nextNote, showAsSharp } = question;
    const { clef, lowestMidiNote, highestMidiNote } = settings.clefs[clefName];
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
                    program: question.program,
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
                lowestMidiNote={lowestMidiNote}
                highestMidiNote={highestMidiNote}
                onKeyDown={handleKeyDown}
            />
        </div>
    )
}

const intervals = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    -1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11, -12
]; // semitones


const Quiz = quiz<Question, number[], Settings>({
    id: 'interval-recognition',
    title: 'Interval recognition',
    description: 'Two notes will be played sequentially, with the first note shown on the staff below. Using the configured MIDI input device or the on-screen piano, play both notes.',
    component: QuestionDisplay,
    settings: {
        clefs: {
            trebleClef: {
                clef: {
                    glyph: 'gClef',
                    line: 3,
                    midiNote: 67, // G4
                },
                enabled: true,
                lowestMidiNote: 60, // C4
                highestMidiNote: 84, // C6
            },
            bassClef: {
                clef: {
                    glyph: 'fClef',
                    line: 1,
                    midiNote: 53, // F3
                },
                enabled: false,
                lowestMidiNote: 36, // C2
                highestMidiNote: 60, // C4
            },
        },
    },
    settingsComponent({ clefs }) {
        return (
            <div>
                {clefNames.map((clefName) => {
                    const value = clefs.value[clefName];

                    function onChange(newValue: ClefSettings) {
                        clefs.onChange({
                            ...clefs.value,
                            [clefName]: newValue,
                        });
                    }

                    return <SingleClefSettings key={clefName} value={value} onChange={onChange} />
                })}
            </div>
        );
    },
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
    generateQuestions({ clefs }) {
        const filtered = clefNames.filter((name) => clefs[name].enabled);
        if (!filtered.length) {
            return [];
        }

        shuffle(intervals);

        return intervals.map((interval) => {
            const clefName = choice(filtered);
            const clef = clefs[clefName];

            // TODO: Ensure we have enough notes on the keyboard
            const note = random(clef.lowestMidiNote, clef.highestMidiNote);

            return {
                program: random(0, 25), // Grand Piano - Acoustic steel guitar
                clefName,
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
