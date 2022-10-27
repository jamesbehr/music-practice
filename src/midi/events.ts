export type MIDIEvent = NoteOnMIDIEvent | NoteOffMIDIEvent | ProgramChangeMIDIEvent;

export enum MIDIEventType {
    ProgramChange,
    NoteOn,
    NoteOff,
}

export function noteOff(note: number, channel: number = 0, velocity: number = 0x7f): NoteOffMIDIEvent {
    return { type: MIDIEventType.NoteOff, note, channel, velocity };
}

export function noteOn(note: number, channel: number = 0, velocity: number = 0x7f): NoteOnMIDIEvent {
    return { type: MIDIEventType.NoteOn, note, channel, velocity };
}

export interface ProgramChangeMIDIEvent {
    type: MIDIEventType.ProgramChange;
    channel: number;
    program: number;
}

export interface NoteOnMIDIEvent {
    type: MIDIEventType.NoteOn;
    channel: number;
    velocity: number;
    note: number;
}

export interface NoteOffMIDIEvent {
    type: MIDIEventType.NoteOff;
    channel: number;
    velocity: number;
    note: number;
}

export function deserializeMIDIEvent(event: Uint8Array): MIDIEvent | undefined {
    const a = event[0];
    const channel = a & 0xf;

    switch (a & 0xf0) {
        case 0x80: {
            const note = event[1] & 0x7f;
            const velocity = event[2] & 0x7f;

            return {
                type: MIDIEventType.NoteOff,
                channel,
                velocity,
                note,
            };
        }
        case 0x90: {
            const note = event[1] & 0x7f;
            const velocity = event[2] & 0x7f;

            // The MIDI spec also allows notes to be switched off by
            // sending note on with zero velocity, normalize handling on
            // these types of events.
            const type = velocity ? MIDIEventType.NoteOn : MIDIEventType.NoteOff;

            return {
                type,
                channel,
                velocity,
                note,
            };
        }
        default:
            console.warn('unhandled input MIDI event', event);
    }
}

export function noteOffData(event: NoteOffMIDIEvent) {
    const channel = event.channel & 0xf;
    return [0x80 | channel, event.note & 0x7f, event.velocity & 0x7f];
}

export function noteOnData(event: NoteOnMIDIEvent) {
    const channel = event.channel & 0xf;
    return [0x90 | channel, event.note & 0x7f, event.velocity & 0x7f];
}

export function serializeMIDIEvent(event: MIDIEvent): number[] | undefined {
    switch (event.type) {
        case MIDIEventType.NoteOff:
            return noteOffData(event);
        case MIDIEventType.NoteOn:
            return noteOnData(event);
        case MIDIEventType.ProgramChange: {
            const channel = event.channel & 0xf;
            return [0xc0 | channel, event.program & 0x7f];
        }
        default:
            console.warn('unhandled event', event);
            break;
    }
}
