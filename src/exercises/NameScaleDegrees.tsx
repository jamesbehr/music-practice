import { Transition } from '@headlessui/react';
import { useState } from 'react';
import { classNames } from '../classNames';
import { quiz, Status, Props } from '../Quiz';
import { shuffle } from '../random';

interface Settings {
    // TODO: multiple scales
    scale: keyof typeof scales;
    degrees: number[];
}

type Step = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

interface Note {
    step: Step;
    alter: number;
}

const steps: Step[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const stepSemitoneDistance = [
    2, // A to B
    1, // B to C
    2, // C to D
    2, // D to E
    1, // E to F
    2, // F to G
    2, // G to A
];

// Given a root note and the number of semitones each scale degree is away from
// that note, build a 7 tone scale that tries to use each letter name only once.
function buildScale(root: Note, semitonesFromRoot: number[]): Note[] {
    const scale = [root];

    let distanceFromRoot = -root.alter;
    for (let degree = 1; degree < semitonesFromRoot.length; degree++) {
        const previousStep = scale[degree - 1];
        const index = steps.indexOf(previousStep.step);

        distanceFromRoot += stepSemitoneDistance[index];
        const desired = semitonesFromRoot[degree - 1];
        const step = steps[(index + 1) % 7];

        const alter = desired - distanceFromRoot;
        scale.push({ step, alter });
    }

    return scale;
}

function noteName(note: Note): string {
    switch (note.alter) {
        case 1:
            return `${note.step}♯`;
        case -1:
            return `${note.step}♭`;
        case 0:
            return note.step;
        default:
            throw new Error(`Cannot build note name for alter=${note.alter}`);
    }
}

const scales = {
    'major-scale': {
        name: (root: Note) => `${noteName(root)} Major`,
        buildScale(root: Note) {
            return buildScale(root, [2, 4, 5, 7, 9, 11, 12]);
        },
    },
    'minor-scale': {
        name: (root: Note) => `${noteName(root)} Minor`,
        buildScale(root: Note) {
            return buildScale(root, [2, 3, 5, 7, 8, 10, 12]);
        },
    },
};

interface Question {
    root: Note;
    scale: keyof typeof scales;
    degree: number;
}

type Answer = Note | undefined;

interface NoteNameEntryProps {
    onSelect: (n: Note) => void;
    correct: Note;
    answer?: Note;
}

function NoteNameEntry({ answer, correct, onSelect }: NoteNameEntryProps) {
    const [step, setStep] = useState<undefined | Step>();

    function setAlter(alter: number) {
        if (step) {
            onSelect({ step, alter });
            setStep(undefined);
        }
    }

    if (answer) {
        if (notesEqual(answer, correct)) {
            return (
                <div className="flex flex-row space-x-2">
                    <button disabled className="rounded-full h-7 w-7 bg-lime-500 text-lime-50">
                        {noteName(answer)}
                    </button>
                </div>
            );
        }

        return (
            <div className="flex flex-row space-x-2">
                <button disabled className="rounded-full h-7 w-7 bg-rose-500 text-rose-50">
                    {noteName(answer)}
                </button>
                <button disabled className="rounded-full h-7 w-7 bg-lime-500 text-lime-50">
                    {noteName(correct)}
                </button>
            </div>
        );
    }

    const buttonClasses = 'rounded-full bg-slate-300 text-slate-700 hover:bg-slate-400';

    return (
        <div className="flex flex-row space-x-2 items-center">
            {steps.map((s, i) => (
                <div key={i} className="relative">
                    <button className={classNames(buttonClasses, 'h-7 w-7')} onClick={() => setStep(s)}>
                        {s}
                    </button>
                    <Transition
                        show={s === step}
                        className="absolute flex flex-row mt-2 -left-2"
                        enter="transition-all duration-500 transform"
                        enterFrom="scale-0 -translate-y-full"
                        enterTo="scale-100 translate-y-0"
                        leave="transition-all duration-500 transform"
                        leaveFrom="scale-100"
                        leaveTo="scale-0"
                    >
                        <button
                            className={classNames(buttonClasses, 'h-7 w-7 -translate-x-full')}
                            onClick={() => setAlter(-1)}
                        >
                            {s}♭
                        </button>
                        <button
                            className={classNames(buttonClasses, 'h-7 w-7 -translate-x-full mx-2')}
                            onClick={() => setAlter(0)}
                        >
                            {s}
                        </button>
                        <button
                            className={classNames(buttonClasses, 'h-7 w-7 -translate-x-full')}
                            onClick={() => setAlter(1)}
                        >
                            {s}♯
                        </button>
                    </Transition>
                </div>
            ))}
        </div>
    );
}

function QuestionDisplay({ answer, updateAnswer, question }: Props<Question, Answer, Settings>) {
    const scaleData = scales[question.scale];

    const name = scaleData.name(question.root);
    const notes = scaleData.buildScale(question.root);
    const correct = notes[question.degree];

    return (
        <div className="flex flex-col items-center">
            <p className="text-slate-700 text-lg mb-4">
                What is the {question.degree + 1} of {name}?
            </p>

            <NoteNameEntry answer={answer} correct={correct} onSelect={(note) => updateAnswer(() => note)} />
        </div>
    );
}

function notesEqual(a: Note, b: Note) {
    return a.step === b.step && b.alter === a.alter;
}

export const NameScaleDegrees = quiz<Question, Answer, Settings>({
    id: 'name-scale-degrees',
    title: 'Name the degrees of a scale',
    description: 'Given a scale, name the degree.',
    component: QuestionDisplay,
    settings: {
        scale: 'major-scale',
        degrees: [4], // Zero indexed, this is the 5th
    },
    settingsComponent() {
        return <div />;
    },
    determineQuestionStatus(question, answer) {
        const scaleData = scales[question.scale];
        const notes = scaleData.buildScale(question.root);
        const correct = notes[question.degree];

        if (answer) {
            if (notesEqual(correct, answer)) {
                return Status.Correct;
            }

            return Status.Incorrect;
        }

        return Status.Unanswered;
    },
    initializeAnswer() {
        return undefined;
    },
    generateQuestions({ scale, degrees }) {
        const chosen = scales[scale];
        const roots = steps.flatMap((step) => [-1, 0, +1].map((alter) => ({ step, alter })));

        // Skip roots that build scales with double sharps or double flats
        const goodRoots = roots.filter((root) => {
            const notes = chosen.buildScale(root);
            return notes.every((note) => Math.abs(note.alter) < 2);
        });

        return shuffle(goodRoots).flatMap((root) => {
            return shuffle(degrees).map((degree) => {
                return {
                    root,
                    scale,
                    degree,
                };
            });
        });
    },
});
