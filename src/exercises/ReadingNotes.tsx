import { quiz, Status, Props } from '../Quiz';
import { shuffle } from '../random';
import { classNames } from '../classNames';
import { Fragment } from 'react';

interface Settings {
    highestFret: number;
}

interface Position {
    fret: number;
    string: number;
}

interface Question {
    /** Note number between 0 (C) and 11 (B) **/
    note: number;
    noteName: string;
    positions: Position[];
}

type Answer = string[];

const stringNames = ['1st', '2nd', '3rd', '4th', '5th', '6th'];

interface StringProps {
    fretClassNames: { [fret: number]: string };
    name: string;
    onSelect: (fret: number) => void;
    highestFret: number;
}

function positionToKey(position: Position): string {
    return `${position.string}-${position.fret}`;
}

function keyToPosition(key: string): Position {
    const [a, b] = key.split('-');

    return {
        string: parseInt(a, 10),
        fret: parseInt(b, 10),
    };
}

function String({ fretClassNames, name, onSelect, highestFret }: StringProps) {
    return (
        <div className="flex flex-row items-center leading-none">
            <div className="mr-4 text-xs font-bold">{name}</div>
            {Array(highestFret + 1)
                .fill(0)
                .map((_, fret) => (
                    <Fragment key={fret}>
                        {fret > 1 && <span className="w-5 border-b" />}
                        <button
                            onClick={() => onSelect(fret)}
                            className={classNames(
                                fretClassNames[fret] || 'bg-slate-300 hover:bg-slate-500 hover:text-slate-200',
                                'text-xs w-5 h-5 rounded-full text-slate-800',
                            )}
                        >
                            {fret}
                        </button>
                        {fret === 0 && <span className="w-2.5 border-b" />}
                        {fret === 0 && <span className="h-7 border-l-4 border-slate-500" />}
                        {fret === 0 && <span className="w-2.5 border-b" />}
                    </Fragment>
                ))}
        </div>
    );
}

function QuestionDisplay({ answer, updateAnswer, question, status, settings }: Props<Question, Answer, Settings>) {
    function updater(string: number) {
        return (fret: number) =>
            updateAnswer((currentAnswer: Answer) => {
                const set = new Set(currentAnswer);

                const key = positionToKey({ string, fret });
                if (set.has(key)) {
                    set.delete(key);
                } else {
                    set.add(key);
                }

                return Array.from(set.values());
            });
    }

    return (
        <div className="flex flex-col items-center">
            <p className="text-slate-700 text-lg mb-4">
                Where is <span className="font-bold">{question.noteName}</span>?
            </p>
            <div className="flex flex-col">
                {strings.flatMap((n) => {
                    const classNames: { [fret: number]: string } = {};

                    answer.forEach((key) => {
                        const { string, fret } = keyToPosition(key);
                        if (string !== n) {
                            return;
                        }

                        if (status === Status.Correct || status === Status.Incorrect) {
                            classNames[fret] = 'bg-rose-500 text-rose-100';
                        } else {
                            classNames[fret] = 'bg-indigo-500 text-indigo-100';
                        }
                    });

                    question.positions.forEach(({ fret, string }) => {
                        if (string !== n) {
                            return;
                        }

                        if (status === Status.Correct || status === Status.Incorrect) {
                            classNames[fret] = 'bg-lime-500 text-lime-100';
                        }
                    });

                    return (
                        <String
                            highestFret={settings.highestFret}
                            key={n}
                            name={stringNames[n]}
                            fretClassNames={classNames}
                            onSelect={updater(n)}
                        />
                    );
                })}
            </div>
        </div>
    );
}

const midiNotesForStrings = [
    64, // high E
    59, // B
    55, // G
    50, // D
    45, // A
    40, // E
];

function note(noteName: string, note: number) {
    return { noteName, note };
}

const notes = [
    note('C', 0),
    note('D', 2),
    note('E', 4),
    note('F', 5),
    note('G', 7),
    note('A', 9),
    note('B', 11),

    // Sharps
    note('C♯', 1),
    note('D♯', 3),
    note('F♯', 6),
    note('G♯', 8),
    note('A♯', 10),

    // Flats
    note('D♭', 1),
    note('E♭', 3),
    note('G♭', 6),
    note('A♭', 8),
    note('B♭', 10),
];
const strings = [3, 4, 5]; // only do the bottom 3 strings

export const ReadingNotes = quiz<Question, Answer, Settings>({
    id: 'reading-notes',
    title: 'Naming notes on the fretboard',
    description: 'Find all the places a note exists on the given strings (standard tuning).',
    component: QuestionDisplay,
    settings: {
        highestFret: 12,
    },
    settingsComponent({ highestFret }) {
        return (
            <input
                value={highestFret.value}
                onChange={(e) => highestFret.onChange(parseInt(e.target.value))}
                type="number"
            />
        );
    },
    determineQuestionStatus(question, answer) {
        if (answer.length === 0) {
            return Status.Unanswered;
        }

        if (answer.length < question.positions.length) {
            return Status.PartiallyAnswered;
        }

        const set = new Set(answer);
        const correct = question.positions.every((position) => set.has(positionToKey(position)));
        return correct ? Status.Correct : Status.Incorrect;
    },
    initializeAnswer() {
        return [];
    },
    generateQuestions({ highestFret }) {
        return shuffle(notes).map(({ noteName, note }) => {
            return {
                note,
                noteName,
                positions: strings.flatMap((string) => {
                    const fretsOnString: Position[] = [];

                    for (let fret = 0; fret <= highestFret; fret++) {
                        const noteAtFret = midiNotesForStrings[string] + fret;
                        if (note === noteAtFret % 12) {
                            fretsOnString.push({ fret, string });
                        }
                    }

                    return fretsOnString;
                }),
            };
        });
    },
});
