import { useState, useMemo, useEffect } from 'react';

interface Event<T> {
    tick: number;
    event: T;
}

type Handler<T> = (event: T) => void;

export class Timer<T> {
    timeoutId: number;
    msPerBeat: number;
    ticksPerBeat: number;
    tick: number;
    startTime: number;
    events: Event<T>[];
    handler: Handler<T>;

    constructor(ticksPerBeat: number, beatsPerMinute: number, handler: Handler<T>) {
        this.timeoutId = 0;
        this.msPerBeat = 1000 / (beatsPerMinute / 60);
        this.tick = 0;
        this.ticksPerBeat = ticksPerBeat;
        this.events = [];
        this.startTime = performance.now();
        this.handler = handler;
    }

    setTempo(beatsPerMinute: number) {
        this.msPerBeat = 1000 / (beatsPerMinute / 60);

        if (this.timeoutId > 0) {
            this.start();
        }
    }

    enqueueTimedEvents(events: Event<T>[]) {
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
                    this.handler(event.event);
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

    clear() {
        this.events = [];
    }
}

export function useTimer<T>(ticksPerBeat: number, beatsPerMinute: number, handler: Handler<T>) {
    const timer = useMemo(
        () => new Timer<T>(ticksPerBeat, beatsPerMinute, handler),
        [ticksPerBeat, beatsPerMinute, handler],
    );
    const [playing, setPlaying] = useState<boolean>(true);

    useEffect(() => {
        timer.start();

        return function unsubscribe() {
            timer.stop();
        };
    }, [timer]);

    return {
        pause() {
            timer.stop();
            setPlaying(false);
        },
        stop() {
            timer.stop();
            timer.clear();
            setPlaying(false);
        },
        play() {
            timer.start();
            setPlaying(true);
        },
        enqueue(events: Event<T>[]) {
            timer.enqueueTimedEvents(events);
        },
        playing,
    };
}
