import { useState, useEffect, useCallback } from 'react';

class MIDIUnsupportedError extends Error {}
class MIDIPermissionDeniedError extends Error {}

/**
 * Calling requestMIDIAccess multiple times will cause the browser to ask for
 * permission repeatedly. The manager memoizes the value to allow multiple
 * consumers of a global instance of this class to request a reference to a
 * single, shared MIDIAccess instance.
 *
 * This also handles browsers that do not support the Web MIDI API.
 **/
class MIDIAccessManager extends EventTarget {
    instance: WebMidi.MIDIAccess | undefined;

    /**
     * Return a promise that resolves to the shared MIDIAccess instance. It
     * will request permission from the user if necessary.
     *
     * If the user denies permission, or the browser does not support the API
     * then an error is returned.
     *
     * TODO: How does a consumer of a port know if access has been revoked
     * later?
     **/
    async request(): Promise<WebMidi.MIDIAccess> {
        if (this.instance) {
            return this.instance;
        }

        if (!window.navigator.requestMIDIAccess) {
            throw new MIDIUnsupportedError();
        }

        try {
            this.instance = await window.navigator.requestMIDIAccess();
        } catch (e) {
            throw new MIDIPermissionDeniedError();
        }

        return this.instance;
    }

    /**
     * Clear the cached MIDIAccess instance so that the next call to request
     * will ask the user's permission again.
     **/
    clear() {
        this.instance = undefined;
    }
}

const globalManager = new MIDIAccessManager();

type UseMIDIAccessState =
    | { status: 'uninitialized' }
    | { status: 'unsupported' }
    | { status: 'permission-denied' }
    | {
          access: WebMidi.MIDIAccess;
          status: 'success';
      };

export function useMIDIAccess() {
    const [state, setState] = useState<UseMIDIAccessState>({
        status: 'uninitialized',
    });

    const [forceUpdate, setForceUpdate] = useState();

    const handleStateChange = useCallback(function (this: WebMidi.MIDIAccess) {
        setState({ status: 'success', access: this });
    }, []);

    // TODO: Handle permission being revoked later
    // TODO: Request sysex option
    useEffect(() => {
        const promise = globalManager.request().then((access) => {
            setState({ status: 'success', access });
            access.addEventListener('statechange', handleStateChange);
            return access;
        });

        promise.catch((error) => {
            if (error instanceof MIDIUnsupportedError) {
                setState({ status: 'unsupported' });
            } else if (error instanceof MIDIPermissionDeniedError) {
                setState({ status: 'permission-denied' });
            } else {
                console.error('Unhandled promise error', error);
            }
        });

        return function unsubscribe() {
            promise.then((access) => {
                access.removeEventListener('statechange', handleStateChange);
            });
        };
    }, [handleStateChange, forceUpdate]);

    return {
        ...state,
        retry() {
            // Clear the cached instance and re-trigger the useEffect hook
            globalManager.clear();
            setForceUpdate(undefined);
        },
    };
}
