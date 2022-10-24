export function FretboardDiagram() {
    const stringSpacing = 30;
    const fretSpacing = 50;
    const strings = [0.01, 0.013, 0.017, 0.026, 0.036, 0.046]; // guage
    const frets = [];
    const guageMultiplier = 50;
    const lastThickness = strings[strings.length - 1] * guageMultiplier;
    const height = strings.length * stringSpacing - stringSpacing + lastThickness / 2;
    const nutThickness = 6;
    const fretThickness = 1;
    const lowestFret = 0;
    const highestFret = 12;

    for (let i = lowestFret; i < highestFret; i++) {
        frets.push(i ? fretThickness : nutThickness);
    }

    const stringLength = frets.length * fretSpacing;
    const symbolRadius = 10;

    const symbols = [
        {
            string: 0, // high e
            fret: 0, // open
            label: 'A',
            textClassName: 'fill-indigo-50',
            className: 'fill-indigo-500',
        },
        {
            string: 5, // low e
            fret: 2,
            label: 'A',
            textClassName: 'fill-lime-50',
            className: 'fill-lime-500',
        },
    ];

    const fretNumbers = [0, 3, 5, 7, 9];

    return (
        <svg height={height + symbolRadius + stringSpacing} width={fretSpacing * frets.length}>
            {strings.map((guage, i) => (
                <line
                    className="stroke-black"
                    style={{ strokeWidth: guage * guageMultiplier }}
                    x1={0}
                    y1={stringSpacing * i}
                    x2={stringLength}
                    y2={stringSpacing * i}
                />
            ))}
            {frets.map((thickness, i) => {
                const fret = i + lowestFret + 1;
                const shouldLabel = fretNumbers.includes(fret % 12);

                return (
                    <>
                        <line
                            className="stroke-black"
                            style={{ strokeWidth: thickness }}
                            x1={fretSpacing * i + nutThickness / 2}
                            y1={0}
                            x2={fretSpacing * i + nutThickness / 2}
                            y2={height}
                        />

                        {shouldLabel && (
                            <text x={i * fretSpacing + fretSpacing / 2} y={height + stringSpacing}>
                                {fret}
                            </text>
                        )}
                    </>
                );
            })}
            {symbols.map(({ fret, string, label, className, textClassName }) => {
                const relativeFret = fret - lowestFret;
                const x = relativeFret ? fretSpacing * relativeFret - fretSpacing / 2 + symbolRadius / 2 : 0;
                const y = stringSpacing * string;

                return (
                    <>
                        <circle className={className} r={symbolRadius} cx={x} cy={y} />
                        <text className={textClassName} x={x - symbolRadius / 2} y={y + symbolRadius / 2}>
                            {label}
                        </text>
                    </>
                );
            })}
        </svg>
    );
}
