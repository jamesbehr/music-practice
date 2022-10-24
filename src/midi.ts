import { useState, useEffect, useMemo, useCallback } from 'react';

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

export function timed(tick: number, event: MIDIEvent): EventAt {
    return { tick, event };
}

interface ProgramChangeMIDIEvent {
    type: MIDIEventType.ProgramChange;
    channel: number;
    program: number;
}

interface NoteOnMIDIEvent {
    type: MIDIEventType.NoteOn;
    channel: number;
    velocity: number;
    note: number;
}

interface NoteOffMIDIEvent {
    type: MIDIEventType.NoteOff;
    channel: number;
    velocity: number;
    note: number;
}

interface EventAt {
    tick: number;
    event: MIDIEvent;
}

export enum MIDIPortStatus {
    Unitialized,
    Unsupported,
    PermissionDenied,
    Success,
}

interface Ports {
    status: MIDIPortStatus;
    outputs: Map<string, WebMidi.MIDIOutput>;
    inputs: Map<string, WebMidi.MIDIInput>;
}

interface DeviceInfo {
    id: string;
    manufacturer: string;
    name: string;
    state: WebMidi.MIDIPortDeviceState;
}

function deviceInfoFromPort(port: WebMidi.MIDIPort): DeviceInfo {
    return {
        id: port.id,
        name: port.name || '',
        manufacturer: port.manufacturer || '',
        state: port.state,
    };
}

interface Output {
    info: DeviceInfo;
    enqueueTimedEvents(events: EventAt[]): void;
    sendEvent(event: MIDIEvent): void;
}

export class RealOutput {
    timeoutId: number;
    msPerBeat: number;
    ticksPerBeat: number;
    tick: number;
    startTime: number;
    events: EventAt[];
    output: WebMidi.MIDIOutput;
    notes: Map<[number, number], boolean>;
    info: DeviceInfo;

    constructor(ticksPerBeat: number, output: WebMidi.MIDIOutput) {
        this.timeoutId = 0;
        this.msPerBeat = 1000 / (120 / 60); // 120 bpm
        this.tick = 0;
        this.ticksPerBeat = ticksPerBeat;
        this.startTime = performance.now();
        this.events = [];
        this.output = output;
        this.notes = new Map();
        this.info = deviceInfoFromPort(output);
    }

    // TODO: This should be an event that sets the tempo
    setTempo(msPerBeat: number) {
        this.msPerBeat = msPerBeat;

        if (this.timeoutId > 0) {
            this.start();
        }
    }

    enqueueTimedEvents(events: EventAt[]) {
        this.events.push(
            ...events.map(({ tick, event }) => ({
                tick: this.tick + tick,
                event,
            })),
        );

        this.events.sort((a, b) => {
            if (a.tick < b.tick) {
                return -1;
            }

            if (a.tick > b.tick) {
                return 1;
            }

            return 0;
        });
    }

    sendEvent(event: MIDIEvent) {
        switch (event.type) {
            case MIDIEventType.NoteOff: {
                this.notes.set([event.note, event.channel], false);

                const channel = event.channel & 0xf;
                this.output.send([0x80 | channel, event.note & 0x7f, event.velocity & 0x7f]);
                break;
            }
            case MIDIEventType.NoteOn: {
                this.notes.set([event.note, event.channel], true);

                const channel = event.channel & 0xf;
                this.output.send([0x90 | channel, event.note & 0x7f, event.velocity & 0x7f]);
                break;
            }
            case MIDIEventType.ProgramChange: {
                const channel = event.channel & 0xf;
                this.output.send([0xc0 | channel, event.program & 0x7f]);
                break;
            }
            default:
                console.warn('unhandled event', event);
                break;
        }
    }

    start() {
        if (this.timeoutId > 0) {
            clearTimeout(this.timeoutId);
        }

        const tick = (startTime?: number) => {
            const currentTime = window.performance.now();
            const msPerTick = this.msPerBeat / this.ticksPerBeat;

            let drift = 0;
            if (startTime !== undefined) {
                drift = msPerTick - (currentTime - startTime);
            }

            while (this.events.length > 0 && this.tick >= this.events[0].tick) {
                const event = this.events.shift()!;

                if (event.tick === this.tick) {
                    this.sendEvent(event.event);
                } else {
                    console.warn('missed event', event, this.tick);
                }
            }

            this.tick++;

            this.timeoutId = window.setTimeout(tick, msPerTick + drift, currentTime);
        };

        tick();
    }

    stop() {
        window.clearTimeout(this.timeoutId);
        this.timeoutId = 0;
        this.output.clear();
        this.notes.forEach((isNoteOn, [note, channel]) => {
            if (isNoteOn) {
                const c = channel & 0xf;
                this.output.send([0x80 | c, note & 0x7f, 0x7f]);
            }
        });
    }
}

export function useMIDIPorts(): Ports {
    function state(
        status: MIDIPortStatus,
        outputs: WebMidi.MIDIOutputMap = new Map(),
        inputs: WebMidi.MIDIInputMap = new Map(),
    ) {
        return { status, outputs, inputs };
    }

    const [ports, setPorts] = useState(state(MIDIPortStatus.Unitialized));

    useEffect(() => {
        // TODO: useCallback
        function handleStateChange(this: WebMidi.MIDIAccess) {
            setPorts(state(MIDIPortStatus.Success, this.outputs, this.inputs));
        }

        if (!window.navigator.requestMIDIAccess) {
            setPorts(state(MIDIPortStatus.Unsupported));
            return;
        }

        const promise = window.navigator.requestMIDIAccess();

        promise
            .then((access) => {
                access.addEventListener('statechange', handleStateChange);
                setPorts(state(MIDIPortStatus.Success, access.outputs, access.inputs));
            })
            .catch(() => {
                setPorts(state(MIDIPortStatus.PermissionDenied));
            });

        return function unsubscribe() {
            promise.then((access) => {
                access.removeEventListener('statechange', handleStateChange);
            });
        };
    }, []);

    return ports;
}

// An output that does nothing
function nullOutput(portId: string) {
    return {
        info: {
            id: portId,
            manufacturer: '',
            name: '',
            state: 'disconnected',
        } as DeviceInfo,
        enqueueTimedEvents() {},
        start() {},
        stop() {},
        sendEvent() {},
    };
}

export function useMIDIOutput(portId: string, ticksPerBeat: number): Output {
    const ports = useMIDIPorts();

    const wrappedOutput = useMemo(() => {
        const output = ports.outputs.get(portId);
        return output ? new RealOutput(ticksPerBeat, output) : nullOutput(portId);
    }, [ports, portId, ticksPerBeat]);

    // TODO: Ensure start/stop when port status changes (disconnect/connect)
    useEffect(() => {
        wrappedOutput.start();

        return function unsubscribe() {
            wrappedOutput.stop();
        };
    }, [ports, portId, wrappedOutput]);

    return wrappedOutput;
}

function parseMIDIEvent(event: WebMidi.MIDIMessageEvent): MIDIEvent | undefined {
    const a = event.data[0];
    const channel = a & 0xf;

    switch (a & 0xf0) {
        case 0x80: {
            const note = event.data[1] & 0x7f;
            const velocity = event.data[2] & 0x7f;

            return {
                type: MIDIEventType.NoteOff,
                channel,
                velocity,
                note,
            };
        }
        case 0x90: {
            const note = event.data[1] & 0x7f;
            const velocity = event.data[2] & 0x7f;

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
            console.warn('unhandled input MIDI event', event.data);
    }
}

export function useMIDIInput(portId: string, handler: (e: MIDIEvent) => void) {
    const ports = useMIDIPorts();

    const handleMidiMessage = useCallback(
        (event: Event) => {
            const midiEvent = event as WebMidi.MIDIMessageEvent;
            const parsed = parseMIDIEvent(midiEvent);
            if (parsed) {
                handler(parsed);
            }
        },
        [handler],
    );

    useEffect(() => {
        const input = ports.inputs.get(portId);
        if (!input) {
            return;
        }

        input.addEventListener('midimessage', handleMidiMessage);

        return function unsubscribe() {
            input.removeEventListener('midimessage', handleMidiMessage);
        };
    }, [portId, ports, handleMidiMessage]);
}

// Accepts events from every connected MIDI input device
export function useAnyMIDIInput(handler: (e: MIDIEvent) => void) {
    const { inputs } = useMIDIPorts();

    const handleMidiMessage = useCallback(
        (event: Event) => {
            const midiEvent = event as WebMidi.MIDIMessageEvent;
            const parsed = parseMIDIEvent(midiEvent);
            if (parsed) {
                handler(parsed);
            }
        },
        [handler],
    );

    useEffect(() => {
        inputs.forEach((input) => {
            input.addEventListener('midimessage', handleMidiMessage);
        });

        return function unsubscribe() {
            inputs.forEach((input) => {
                input.removeEventListener('midimessage', handleMidiMessage);
            });
        };
    }, [inputs, handleMidiMessage]);
}
