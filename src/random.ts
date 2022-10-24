export function random(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

export function shuffle<T>(array: T[]): T[] {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

export function choice<T>(options: T[]): T {
    if (options.length < 1) {
        throw new Error('must have at least one option');
    }

    const index = random(0, options.length - 1);
    return options[index];
}
