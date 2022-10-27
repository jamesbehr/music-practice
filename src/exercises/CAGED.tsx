import { quiz, Status, Props } from '../Quiz';
import { shuffle } from '../random';
import { FretboardDiagram, Symbol } from '../FretboardDiagram';

interface Settings {}

interface Question {}

type Answer = string[];

function key(name: string, relativeMinor: string, fretOn6thString: number) {
    return { name, relativeMinor, fretOn6thString };
}

const keys = [
    key('C', 'A', 8), // 0 sharps
    key('G', 'E', 3), // 1 sharp
    key('D', 'B', 10), // 2 sharp
    key('A', 'F♯', 5), // 3 sharps
    key('E', 'C♯', 0), // 4 sharps
    key('B', 'G♯', 7), // 5 sharps
    key('F♯', 'D♯', 2), // 6 sharps
    key('C♯', 'A♯', 9), // 7 sharps
    key('F', 'D', 1), // 1 flat
    key('B♭', 'G', 6), // 2 flats
    key('E♭', 'C', 11), // 3 flats
    key('A♭', 'F', 4), // 4 flats
    key('D♭', 'B♭', 9), // 5 flats
    key('G♭', 'E♭', 2), // 6 flats
    key('C♭', 'A♭', 7), // 7 flats
];

interface Shape {
    name: string;
    symbols: Symbol[];
    lowestFret: number;
    highestFret: number;
}

function buildShape(name: string, symbols: Symbol[]): Shape {
    const frets = symbols.map(({ fret }) => fret);
    const lowestFret = Math.min(...frets);
    const highestFret = Math.max(...frets);

    if (lowestFret < 0) {
        return {
            name,
            lowestFret: lowestFret + 12,
            highestFret: highestFret + 12,
            symbols: symbols.map((symbol) => ({
                ...symbol,
                fret: symbol.fret + 12,
            })),
        };
    }

    return { name, symbols, lowestFret, highestFret };
}

function buildShapes(firstFret: number): Shape[] {
    function root(string: number, fret: number, label: string): Symbol {
        return { string, fret, label, textClassName: 'fill-indigo-50', className: 'fill-indigo-500' };
    }

    function triad(string: number, fret: number, label: string): Symbol {
        return { string, fret, label, textClassName: 'fill-slate-50', className: 'fill-slate-500' };
    }

    function scale(string: number, fret: number, label: string): Symbol {
        return { string, fret, label, textClassName: 'fill-slate-700', className: 'stroke-slate-500 fill-slate-50' };
    }

    return [
        buildShape('C', [
            triad(5, firstFret + 4, '3'),
            triad(5, firstFret + 7, '5'),
            scale(4, firstFret + 4, '6'),
            root(4, firstFret + 7, '1'),
            scale(3, firstFret + 4, '2'),
            triad(3, firstFret + 6, '3'),
            triad(2, firstFret + 4, '5'),
            scale(2, firstFret + 6, '6'),
            root(1, firstFret + 5, '1'),
            scale(1, firstFret + 7, '2'),
            triad(0, firstFret + 4, '3'),
            triad(0, firstFret + 7, '5'),
        ]),
        buildShape('A', [
            triad(5, firstFret + 7, '5'),
            scale(5, firstFret + 9, '6'),
            root(4, firstFret + 7, '1'),
            scale(4, firstFret + 9, '2'),
            triad(3, firstFret + 6, '3'),
            triad(3, firstFret + 9, '5'),
            scale(2, firstFret + 6, '6'),
            root(2, firstFret + 9, '1'),
            scale(1, firstFret + 7, '2'),
            triad(1, firstFret + 9, '3'),
            triad(0, firstFret + 7, '5'),
            scale(0, firstFret + 9, '6'),
        ]),
        buildShape('G', [
            scale(5, firstFret + 9, '6'),
            root(5, firstFret + 12, '1'),
            scale(4, firstFret + 9, '2'),
            triad(4, firstFret + 11, '3'),
            triad(3, firstFret + 9, '5'),
            scale(3, firstFret + 11, '6'),
            root(2, firstFret + 9, '1'),
            scale(2, firstFret + 11, '2'),
            triad(1, firstFret + 9, '3'),
            triad(1, firstFret + 12, '5'),
            scale(0, firstFret + 9, '6'),
            root(0, firstFret + 12, '1'),
        ]),
        buildShape('E', [
            root(5, firstFret + 0, '1'),
            scale(5, firstFret + 2, '2'),
            triad(4, firstFret - 1, '3'),
            triad(4, firstFret + 2, '5'),
            scale(3, firstFret - 1, '6'),
            root(3, firstFret + 2, '1'),
            scale(2, firstFret - 1, '2'),
            triad(2, firstFret + 1, '3'),
            triad(1, firstFret + 0, '5'),
            scale(1, firstFret + 2, '6'),
            root(0, firstFret + 0, '1'),
            scale(0, firstFret + 2, '2'),
        ]),
        buildShape('D', [
            scale(5, firstFret + 2, '2'),
            triad(5, firstFret + 4, '3'),
            triad(4, firstFret + 2, '5'),
            scale(4, firstFret + 4, '6'),
            root(3, firstFret + 2, '1'),
            scale(3, firstFret + 4, '2'),
            triad(2, firstFret + 1, '3'),
            triad(2, firstFret + 4, '5'),
            scale(1, firstFret + 2, '6'),
            root(1, firstFret + 5, '1'),
            scale(0, firstFret + 2, '2'),
            triad(0, firstFret + 4, '3'),
        ]),
    ];
}

function CheckedItem({ children }: { children: React.ReactNode }) {
    return (
        <li>
            <input type="checkbox" />
            {children}
        </li>
    );
}

function QuestionDisplay(_: Props<Question, Answer, Settings>) {
    const { name, relativeMinor, fretOn6thString } = keys[4];
    const shapes = buildShapes(fretOn6thString);

    return (
        <div className="flex flex-col items-center">
            <p className="text-slate-700 mb-4 flex flex-row">
                <ol>
                    <CheckedItem>{name} major triad</CheckedItem>
                    <CheckedItem>{name} major pentatonic</CheckedItem>
                    <CheckedItem>{name} lydian</CheckedItem>
                    <CheckedItem>{name} major scale/ionian</CheckedItem>
                    <CheckedItem>{name} mixolydian</CheckedItem>
                </ol>

                <ol>
                    <CheckedItem>{relativeMinor} major triad</CheckedItem>
                    <CheckedItem>{relativeMinor} minor pentatonic</CheckedItem>
                    <CheckedItem>{relativeMinor} dorian</CheckedItem>
                    <CheckedItem>{relativeMinor} natural minor/aeolian</CheckedItem>
                    <CheckedItem>{relativeMinor} phrygian</CheckedItem>
                </ol>
            </p>
            <div className="flex flex-col space-y-2">
                {shapes.map((shape) => (
                    <FretboardDiagram
                        key={shape.name}
                        symbols={shape.symbols}
                        lowestFret={Math.max(0, shape.lowestFret - 1)}
                        highestFret={shape.highestFret}
                    />
                ))}
            </div>
        </div>
    );
}

export const CAGED = quiz<Question, Answer, Settings>({
    id: 'scales',
    title: 'Play scales',
    description: 'Play major and minor scales modes within the CAGED shapes.',
    component: QuestionDisplay,
    settings: {},
    settingsComponent() {
        return <div>'There are no settings'</div>;
    },
    determineQuestionStatus() {
        return Status.Incorrect;
    },
    initializeAnswer() {
        return [];
    },
    generateQuestions() {
        return shuffle(keys).map(() => {
            return {};
        });
    },
});
