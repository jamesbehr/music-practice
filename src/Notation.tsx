import { useContext, createContext } from 'react';
import bravuraMetadata from './smufl/bravura_metadata.json';
import glyphNames from './smufl/glyphnames.json';

function translate(x: number, y: number): string {
    return `translate(${x}, ${y})`;
}

function translateY(y: number): string {
    return translate(0, y);
}

function translateX(x: number): string {
    return translate(x, 0);
}

function em(x: number): number {
    return x * fontSize * lineSpacing;
}

type GlyphNames = typeof glyphNames;
type Glyph = keyof GlyphNames;

function glyph(name: Glyph) {
    const { codepoint } = glyphNames[name];
    const hex = codepoint.replace('U+', '');
    return String.fromCodePoint(parseInt(hex, 16));
}

// TODO: Calculate based on staff lines
const lineSpacing = 0.25; // Divide the em in four for a five line staff (there are four spaces)
const fontSize = 48;

function computeLedgerLines(noteLine: number, staffLines: number) {
    const nearestLine = Math.ceil(noteLine);

    if (nearestLine < 0) {
        const count = -nearestLine;

        return { count, start: -count };
    } if (nearestLine >= staffLines) {
        return { count: nearestLine - staffLines + 1, start: staffLines };
    }

    return { count: 0, start: 0 };
}

interface SingleNoteProps {
    note: number;
    accidentalGlyph?: 'accidentalSharp' | 'accidentalFlat';
    noteGlyph: 'noteWhole';
    clefGlyph: 'gClef' | 'fClef';
    clefLine: number;
}

function glyphHeightAboveOrigin(glyph: keyof typeof bravuraMetadata.glyphBBoxes) {
    const { bBoxNE, bBoxSW } = bravuraMetadata.glyphBBoxes[glyph];
    const [right, top] = bBoxNE;
    const [left, bottom] = bBoxSW;
    return Math.abs(top); // height above origin
}

interface PositionedGlyph {
    glyph: keyof typeof bravuraMetadata.glyphBBoxes;
    line: number;
};

function glyphBoundingBox(glyph: keyof typeof bravuraMetadata.glyphBBoxes, glyphLine: number) {
    const { bBoxNE, bBoxSW } = bravuraMetadata.glyphBBoxes[glyph];
    const [right, top] = bBoxNE;
    const [left, bottom] = bBoxSW;
    return { top: top - glyphLine, bottom: bottom - glyphLine };
}

function glyphHeightExtents(glyphs: PositionedGlyph[]) {
    const extents = glyphs.map(({ glyph, line }) => glyphBoundingBox(glyph, line));
    const tops = extents.map(({ top }) => top);
    const bottoms = extents.map(({ bottom }) => bottom);

    return { top: Math.max(...tops), bottom: Math.min(...bottoms) };
}

// function glyphHeightExtents
export function SingleNote({ note, clefLine, clefGlyph, noteGlyph, accidentalGlyph }: SingleNoteProps) {
    const padding = 0.25;
    const clefPadding = 1;
    const noteLine = note * 0.5; // allow note to be placed between lines
    const accidentalPadding = accidentalGlyph ? 0.25 : 0;
    const staffLines = 5;
    const ledgerLines = computeLedgerLines(noteLine, staffLines);
    const lineStyle = { strokeWidth: 0.5, stroke: 'black' };
    const clefWidth = bravuraMetadata.glyphAdvanceWidths[clefGlyph];
    const noteWidth = bravuraMetadata.glyphAdvanceWidths[noteGlyph];
    const accidentalWidth = accidentalGlyph ? bravuraMetadata.glyphAdvanceWidths[accidentalGlyph] : 0;
    const staffWidth = clefWidth + noteWidth + clefPadding + accidentalWidth + accidentalPadding + 1;

    // Work out how much of each glyph juts out above and below the staff
    // The staff is not included in extents as it is always 1em
    const glyphs: PositionedGlyph[] = [
        { glyph: noteGlyph, line: noteLine },
        { glyph: clefGlyph, line: clefLine },
    ];

    if (accidentalGlyph) {
        glyphs.push({ glyph: accidentalGlyph, line: noteLine });
    }

    const extents = glyphHeightExtents(glyphs);
    const offsetY = extents.top + padding;
    const height = Math.abs(extents.bottom) + offsetY + padding;

    return (
        <svg className="test" style={{ fontSize }} width={em(staffWidth)} height={em(height)}>
            <g transform={translateY(em(offsetY))}>
                <g style={lineStyle}>
                    {Array(staffLines).fill(0).map((_, index) => (
                        <line key={index} x2={em(staffWidth)} y1={em(index)} y2={em(index)} />
                    ))}
                </g>

                <text y={em(clefLine)}>{glyph(clefGlyph)}</text>

                <g transform={translateX(em(clefPadding + clefWidth))}>
                    {accidentalGlyph && <text y={em(noteLine)}>{glyph(accidentalGlyph)}</text>}

                    <g style={lineStyle} transform={translateX(em(accidentalWidth + accidentalPadding))}>
                        {Array(ledgerLines.count).fill(0).map((_, index) => (
                            <line
                                key={index}
                                x2={em(noteWidth)}
                                y1={em(ledgerLines.start + index)}
                                y2={em(ledgerLines.start + index)}
                            />
                        ))}
                    </g>

                    <text x={em(accidentalWidth + accidentalPadding)} y={em(noteLine)}>{glyph("noteWhole")}</text>
                </g>
            </g>
        </svg>
    );
}
