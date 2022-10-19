import './App.css';
import { timed, noteOn, noteOff, MIDIEventType, MIDIPortStatus, useMIDIPorts, useMIDIOutput } from './midi';
import { SingleNote } from './Notation';
import { Keyboard } from './Keyboard';
import { unsharpen, unflatten, isKeyBlack } from './notes';
import { quiz, Status, Props, SettingProps } from './Quiz';
import { shuffle, random, choice } from './random';

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
    };
    midiInputId: string;
    midiOutputId: string;
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

type MIDIPortsSettingsProps = SettingProps<string> & {
    type: 'inputs' | 'outputs';
};

function MIDIPortsSettings({ type, value, onChange }: MIDIPortsSettingsProps) {
    const ports = useMIDIPorts();

    switch (ports.status) {
        case MIDIPortStatus.Unitialized:
            return <div>Loading...</div>;
        case MIDIPortStatus.Unsupported:
            return <div>Your browser does not support the Web MIDI API</div>;
        case MIDIPortStatus.PermissionDenied:
            return <div>Please allow this site to use MIDI</div>;
    }

    const allPorts = ports[type] as Map<string, WebMidi.MIDIPort>;

    return (
        <div>
            {Array.from(allPorts.values()).map((port: WebMidi.MIDIPort) => (
                <div key={port.id}>
                    <label>
                        <input
                            type="radio"
                            name={type}
                            onChange={() => onChange(port.id)}
                            checked={value === port.id}
                        />
                        {port.name}
                    </label>
                </div>
            ))}
        </div>
    );
}

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

    const output = useMIDIOutput(settings.midiOutputId, 1);

    function playNote() {
        output.enqueueTimedEvents([
            {
                tick: 0,
                event: {
                    type: MIDIEventType.ProgramChange,
                    channel: 0,
                    program: question.program,
                },
            },
            timed(0, noteOn(note)),
            timed(1, noteOff(note)),
            timed(1, noteOn(nextNote)),
            timed(2, noteOff(nextNote)),
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
                outputId={settings.midiOutputId}
                inputId={settings.midiInputId}
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
        midiInputId: '',
        midiOutputId: '',
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
    settingsComponent({ clefs, midiInputId, midiOutputId }) {
        return (
            <div>
                <h2>MIDI Input</h2>
                <MIDIPortsSettings {...midiInputId} type="inputs" />
                <h2>MIDI Output</h2>
                <MIDIPortsSettings {...midiOutputId} type="outputs" />
                <h2>Clefs</h2>
                {
                    clefNames.map((clefName) => {
                        const value = clefs.value[clefName];

                        function onChange(newValue: ClefSettings) {
                            clefs.onChange({
                                ...clefs.value,
                                [clefName]: newValue,
                            });
                        }

                        return <SingleClefSettings key={clefName} value={value} onChange={onChange} />
                    })
                }
            </div >
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

function App() {
    return (
        <div className="App">
            <Quiz />
        </div>
    );
}

export default App;
