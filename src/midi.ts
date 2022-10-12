type SomeEvent = NoteOnEvent | NoteOffEvent | ProgramChangeEvent;

// TODO: Enum type?
interface ProgramChangeEvent {
    type: 'program-change',
    channel: number;
    program: number;
};

interface NoteOnEvent {
    type: 'note-on',
    channel: number;
    velocity: number;
    note: number;
};

interface NoteOffEvent {
    type: 'note-off';
    channel: number;
    velocity: number;
    note: number;
};

interface AbsoluteEvent {
    tick: number;
    event: SomeEvent;
};

interface DeltaEvent {
    deltaTick: number;
    event: SomeEvent;
};

enum Status {
    Unitialized,
    Unsupported,
    PermissionDenied,
    Success,
}

// TODO: Name
export class Midi extends EventTarget {
    access : WebMidi.MIDIAccess | null;
    output : WebMidi.MIDIOutput | null;
    status: Status;

    constructor() {
        super();

        this.access = null;
        this.output = null;
        this.status = Status.Unitialized;
    }

    connect() {
        if (!window.navigator.requestMIDIAccess) {
            this.status = Status.Unsupported;
            // TODO: Send state changed event
        }

        // TODO: Listen for both? Might not be neccessary
        // https://developer.mozilla.org/en-US/docs/Web/API/MIDIAccess/statechange_event
        // https://developer.mozilla.org/en-US/docs/Web/API/MIDIPort/statechange_event

        window.navigator.requestMIDIAccess().then((midiAccess) => {
            this.access = midiAccess;
            this.status = Status.Success;
            this.access.addEventListener('statechange', this.handleStateChange);
            this.dispatchEvent(new Event('outputs-changed'));
        }).catch((error) => {
            this.status = Status.PermissionDenied;
            // TODO: Send state changed event
        });
    }

    handleStateChange(event: Event) {
        this.dispatchEvent(new Event('outputs-changed'));
    }

    disconnect() {
        if (this.access) {
            this.access.removeEventListener('statechange', this.handleStateChange);
        }
    }

    outputs(): WebMidi.MIDIOutput[] {
        if (this.access) {
            return Array.from(this.access.outputs.values());
        }

        return [];
    }

    setOutput(output: WebMidi.MIDIOutput) {
        if (this.output !== null) {
            // TODO: Clear any notes that were on
            this.output.clear();
        }

        this.output = output;
        this.dispatchEvent(new Event('outputs-changed'));
    }

    playEvent(event: SomeEvent) {
        if (!this.access) {
            console.warn('skipping event - MIDI not connected', event);
            return;
        }

        if (!this.output) {
            console.warn('skipping event - output not connected', event);
            return;
        }

        switch (event.type) {
            case 'note-off': {
                const channel = event.channel & 0xf;
                this.output.send([0x80 | channel, event.note & 0x7f, event.velocity & 0x7f]);
                break;
            }
            case 'note-on': {
                const channel = event.channel & 0xf;
                this.output.send([0x90 | channel, event.note & 0x7f, event.velocity & 0x7f]);
                break;
            }
            case 'program-change': {
                const channel = event.channel & 0xf;
                this.output.send([0xc0 | channel, event.program & 0x7f]);
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
    midi: Midi;

    constructor(ticksPerBeat: number, midi: Midi) {
        this.timeoutId = 0;
        this.msPerBeat = 1000 / (120 / 60); // 120 bpm
        this.tick = 0;
        this.ticksPerBeat = ticksPerBeat;
        this.startTime = performance.now();
        this.events = [];
        this.midi = midi;
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
                    this.midi.playEvent(event.event);
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
