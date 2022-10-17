import { useState, useEffect, useContext, createContext } from 'react';

type AnyEvent = NoteOnEvent | NoteOffEvent | ProgramChangeEvent;

export enum EventType {
    ProgramChange,
    NoteOn,
    NoteOff,
}

function noteOff(deltaTick: number, note: number): DeltaEvent {
    return {
        deltaTick,
        event: {
            type: EventType.NoteOff,
            note,
            channel: 0,
            velocity: 0x7f,
        },
    };
}

function noteOn(deltaTick: number, note: number): DeltaEvent {
    return {
        deltaTick,
        event: {
            type: EventType.NoteOn,
            note,
            channel: 0,
            velocity: 0x7f,
        },
    };
}

export function noteOnOff(deltaTick: number, duration: number, note: number): DeltaEvent[] {
    return [
        noteOn(deltaTick, note),
        noteOff(deltaTick + duration, note),
    ];
}

interface ProgramChangeEvent {
    type: EventType.ProgramChange;
    channel: number;
    program: number;
};

interface NoteOnEvent {
    type: EventType.NoteOn;
    channel: number;
    velocity: number;
    note: number;
};

interface NoteOffEvent {
    type: EventType.NoteOff;
    channel: number;
    velocity: number;
    note: number;
};

interface AbsoluteEvent {
    tick: number;
    event: AnyEvent;
};

interface DeltaEvent {
    deltaTick: number;
    event: AnyEvent;
};

export enum Status {
    Unitialized,
    Unsupported,
    PermissionDenied,
    Success,
}

interface PersistentStorage {
    set(key: string, value: string): void;
    get(key: string): string | null;
}

const localStorageAdapater = {
    set(key: string, value: string): void {
        window.localStorage.setItem(key, value);
    },
    get(key: string) {
        return window.localStorage.getItem(key);
    }
};

export class Manager extends EventTarget {
    access: WebMidi.MIDIAccess | null;
    status: Status;
    storage: PersistentStorage;

    constructor(storage?: PersistentStorage) {
        super();

        this.access = null;
        this.status = Status.Unitialized;
        this.storage = storage || localStorageAdapater;
    }

    connect() {
        if (!window.navigator.requestMIDIAccess) {
            this.status = Status.Unsupported;
            this.dispatchDevicesChanged();
            return;
        }

        return window.navigator.requestMIDIAccess().then((midiAccess) => {
            this.access = midiAccess;
            this.status = Status.Success;

            // Add event listeners to persisted inputs
            const storedInput = this.getInput();
            if (storedInput) {
                storedInput.addEventListener('midimessage', this.handleMidiMessage);
            }

            this.access.addEventListener('statechange', this.handleStateChange);
            this.dispatchDevicesChanged();
        }).catch((error) => {
            this.status = Status.PermissionDenied;
            this.dispatchDevicesChanged();
        });
    }

    handleStateChange = (event: Event) => {
        this.dispatchDevicesChanged();
    };

    handleMidiMessage = (event: Event) => {
        console.log(event);
    };

    dispatchDevicesChanged() {
        this.dispatchEvent(new Event('devices-changed'));
    }

    disconnect() {
        if (this.access) {
            this.access.removeEventListener('statechange', this.handleStateChange);
        }
    }

    inputs(): WebMidi.MIDIInput[] {
        if (this.access) {
            return Array.from(this.access.inputs.values());
        }

        return [];
    }

    getInput(): WebMidi.MIDIInput | undefined {
        if (!this.access) {
            return;
        }

        const id = this.storage.get('input');
        if (!id) {
            return;
        }

        return this.access.inputs.get(id);
    }

    setInput(input: WebMidi.MIDIInput) {
        // Unsubscribe the previous input from events
        const currentInput = this.getInput();
        if (currentInput) {
            currentInput.removeEventListener('midimessage', this.handleMidiMessage);
        }

        this.storage.set('input', input.id);
        input.addEventListener('midimessage', this.handleMidiMessage);
        this.dispatchDevicesChanged();
    }

    outputs(): WebMidi.MIDIOutput[] {
        if (this.access) {
            return Array.from(this.access.outputs.values());
        }

        return [];
    }

    getOutput(): WebMidi.MIDIOutput | undefined {
        if (!this.access) {
            return;
        }

        const id = this.storage.get('output');
        if (!id) {
            return;
        }

        return this.access.outputs.get(id);
    }

    setOutput(output: WebMidi.MIDIOutput) {
        const currentOutput = this.getOutput();
        if (currentOutput) {
            // TODO: Clear any notes that were on
            currentOutput.clear();
        }

        this.storage.set('output', output.id);
        this.dispatchDevicesChanged();
    }

    playEvent(event: AnyEvent) {
        if (!this.access) {
            console.warn('skipping event - MIDI not connected', event);
            return;
        }

        const output = this.getOutput();
        if (!output) {
            console.warn('skipping event - output not connected', event);
            return;
        }

        switch (event.type) {
            case EventType.NoteOff: {
                const channel = event.channel & 0xf;
                output.send([0x80 | channel, event.note & 0x7f, event.velocity & 0x7f]);
                break;
            }
            case EventType.NoteOn: {
                const channel = event.channel & 0xf;
                output.send([0x90 | channel, event.note & 0x7f, event.velocity & 0x7f]);
                break;
            }
            case EventType.ProgramChange: {
                const channel = event.channel & 0xf;
                output.send([0xc0 | channel, event.program & 0x7f]);
                break;
            }
            default:
                console.warn('unhandled event', event);
                break;
        }
    }
};

// TODO: Maybe this should be a track player, since tracks can have independent tempos?
export class Player {
    timeoutId: number;
    msPerBeat: number;
    ticksPerBeat: number;
    tick: number;
    startTime: number;
    events: AbsoluteEvent[];
    manager: Manager;

    constructor(ticksPerBeat: number, manager: Manager) {
        this.timeoutId = 0;
        this.msPerBeat = 1000 / (120 / 60); // 120 bpm
        this.tick = 0;
        this.ticksPerBeat = ticksPerBeat;
        this.startTime = performance.now();
        this.events = [];
        this.manager = manager;
    };

    // TODO: This should be an event that sets the tempo
    setTempo(msPerBeat: number) {
        this.msPerBeat = msPerBeat;

        if (this.timeoutId > 0) {
            this.start();
        }
    }

    addEvents(events: DeltaEvent[]) {
        // TODO: Insert sorted
        this.events.push(...events.map(({ deltaTick, event }) => ({
            tick: this.tick + deltaTick,
            event,
        })));

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

    start() {
        if (this.timeoutId > 0) {
            clearTimeout(this.timeoutId);
        }

        const startedAt = window.performance.now();

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
                    this.manager.playEvent(event.event);
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
    }
}

export const defaultManager = new Manager;
export const MIDIOutputContext = createContext<Manager>(defaultManager);

// TODO: Maybe have a separate thing for each output/inputs/state
export function useMIDI() {
    const manager = useContext(MIDIOutputContext);
    const [state, forceUpdate] = useState({ manager });

    useEffect(() => {
        function update() {
            forceUpdate({ manager: manager });
        }

        manager.addEventListener('devices-changed', update);

        return function unsubscribe() {
            manager.removeEventListener('devices-changed', update);
        };
    });

    return state;
}
