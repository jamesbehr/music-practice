import './App.css';
import { timed, noteOn, noteOff, MIDIEventType, MIDIPortStatus, useMIDIPorts, useMIDIOutput, useAnyMIDIInput } from './midi';
import { SingleNote } from './Notation';
import { Keyboard } from './Keyboard';
import { unsharpen, unflatten, isKeyBlack } from './notes';
import { quiz, Status, Props, SettingProps } from './Quiz';
import { shuffle, random, choice } from './random';
import { useState, Fragment } from 'react';
import { Listbox, Transition } from '@headlessui/react'
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/24/outline';

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
    label: string;
};

function classNames(...classes: string[]): string {
    return classes.filter(Boolean).join(' ')
}

function MIDIPortsSettings({ label, type, value, onChange }: MIDIPortsSettingsProps) {
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
    const selectedPort = allPorts.get(value);

    return (
        <Listbox value={value} onChange={onChange}>
            {({ open }) => (
                <>
                    <Listbox.Label className="block text-sm font-medium text-gray-700">{label}</Listbox.Label>
                    <div className="relative mt-1">
                        <Listbox.Button className="relative w-full cursor-default rounded-md border border-gray-300 bg-white py-2 pl-3 pr-10 text-left shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm">
                            <span className="flex items-center">
                                <span className="ml-3 block truncate">{selectedPort?.name || "Select a MIDI Device"}</span>
                            </span>
                            <span className="pointer-events-none absolute inset-y-0 right-0 ml-3 flex items-center pr-2">
                                <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                            </span>
                        </Listbox.Button>

                        <Transition
                            show={open}
                            as={Fragment}
                            leave="transition ease-in duration-100"
                            leaveFrom="opacity-100"
                            leaveTo="opacity-0"
                        >
                            <Listbox.Options className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                                {Array.from(allPorts.values()).map((port: WebMidi.MIDIPort) => (
                                    <Listbox.Option
                                        key={port.id}
                                        className={({ active }) => classNames(active ? 'text-white bg-indigo-600' : 'text-gray-900', 'relative cursor-default select-none py-2 pl-3 pr-9')}
                                        value={port.id}>
                                        {({ selected, active }) => (
                                            <>
                                                <div className="flex items-center">
                                                    <span className={classNames(selected ? 'font-semibold' : 'font-normal', 'ml-3 block truncate')}>
                                                        {port.name}
                                                    </span>
                                                </div>

                                                {selected ? (
                                                    <span
                                                        className={classNames(
                                                            active ? 'text-white' : 'text-indigo-600',
                                                            'absolute inset-y-0 right-0 flex items-center pr-4'
                                                        )}
                                                    >
                                                        <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                                    </span>
                                                ) : null}
                                            </>
                                        )}
                                    </Listbox.Option>
                                ))}
                            </Listbox.Options>
                        </Transition>
                    </div>
                </>
            )
            }
        </Listbox >
    );
}

// TODO: Show both lowest and highest notes
function SingleClefSettings({ value, onChange }: SettingProps<ClefSettings>) {
    const note = value.lowestMidiNote;
    const { lowestMidiNote, highestMidiNote, clef, enabled } = value;
    const staffLine = unsharpen(note) - unsharpen(clef.midiNote);

    const [mapping, setMapping] = useState(0);
    useAnyMIDIInput((event) => {
        if (mapping) {
            if (event.type === MIDIEventType.NoteOn) {
                if (mapping === 1) {
                    onChange({ ...value, lowestMidiNote: event.note });
                } else {
                    onChange({ ...value, highestMidiNote: event.note });
                }

                setMapping(0);
            }
        }
    });

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
            <button onClick={() => setMapping(1)}>Map note</button>
            <label>
                <input
                    type="number"
                    value={lowestMidiNote}
                    onChange={(e) => onChange({ ...value, lowestMidiNote: parseInt(e.target.value, 10) })}
                />
                Lowest note
            </label>
            <button onClick={() => setMapping(2)}>Map note</button>
            <label>
                <input
                    type="number"
                    value={highestMidiNote}
                    onChange={(e) => onChange({ ...value, highestMidiNote: parseInt(e.target.value, 10) })}
                />
                Highest note
            </label>
        </div >
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
                <MIDIPortsSettings {...midiInputId} type="inputs" label="MIDI Input" />
                <MIDIPortsSettings {...midiOutputId} type="outputs" label="MIDI Output" />
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
