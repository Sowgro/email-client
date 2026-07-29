export interface AccountProfile {
    emailAddress: string;
}

interface StoredToken {
    accessToken: string;
    expiresAt: number;
}

interface TokenResponse {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
}

interface TokenClient {
    callback: (response: TokenResponse) => void;
    requestAccessToken: (options: {prompt: string}) => void;
}

interface GoogleIdentityServices {
    accounts: {
        oauth2: {
            initTokenClient: (options: {
                client_id: string;
                scope: string;
                callback: (response: TokenResponse) => void;
                error_callback: (error: unknown) => void;
            }) => TokenClient;
            revoke: (accessToken: string, callback: () => void) => void;
        };
    };
}

const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest';
const SCOPES = 'https://mail.google.com/';
const STORAGE_KEY = 'fettuccemail.google-token';
const REFRESH_MARGIN_MS = 60_000;

export class AuthService {
    public ready = $state(false);
    public busy = $state(false);
    public authenticated = $state(false);
    public profile: AccountProfile | undefined = $state();
    public error: string | undefined = $state();

    private tokenClient: TokenClient | undefined;
    private expiresAt = 0;
    private refreshTimer: ReturnType<typeof setTimeout> | undefined;
    private initialization: Promise<void> | undefined;
    private rejectTokenRequest: ((reason: Error) => void) | undefined;

    public initialize(): Promise<void> {
        if (!this.initialization) {
            this.initialization = this.initializeGoogleApis();
        }

        return this.initialization;
    }

    public async signIn() {
        this.busy = true;
        this.error = undefined;

        try {
            await this.initialize();
            await this.requestToken('consent');
            await this.loadProfile();
            this.authenticated = true;
            this.scheduleRefresh();
        } catch (error) {
            this.clearSession();
            this.error = getErrorMessage(error);
        } finally {
            this.busy = false;
        }
    }

    public async signOut() {
        const accessToken = gapi.client.getToken()?.access_token;
        this.clearSession();

        if (accessToken && window.google?.accounts.oauth2) {
            await new Promise<void>((resolve) => {
                window.google!.accounts.oauth2.revoke(accessToken, resolve);
            });
        }
    }

    public destroy() {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
    }

    private async initializeGoogleApis() {
        const clientId = import.meta.env.VITE_CLIENT_ID?.trim();
        const apiKey = import.meta.env.VITE_API_KEY?.trim();

        if (!clientId || !apiKey) {
            this.error = 'Google OAuth is not configured. Add VITE_CLIENT_ID and VITE_API_KEY to .env.';
            this.ready = true;
            return;
        }

        try {
            await Promise.all([
                loadScript('google-api-script', 'https://apis.google.com/js/api.js', () => Boolean(window.gapi)),
                loadScript('google-identity-script', 'https://accounts.google.com/gsi/client', () => Boolean(window.google)),
            ]);

            await new Promise<void>((resolve, reject) => {
                gapi.load('client', {
                    callback: resolve,
                    onerror: () => reject(new Error('Could not initialize the Google API client.')),
                });
            });

            await gapi.client.init({
                apiKey,
                discoveryDocs: [DISCOVERY_DOC],
            });

            this.tokenClient = window.google!.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: SCOPES,
                callback: () => undefined,
                error_callback: (error) => {
                    const message = getErrorMessage(error);
                    this.rejectTokenRequest?.(new Error(message));
                    this.rejectTokenRequest = undefined;
                },
            });

            await this.restoreSession();
        } catch (error) {
            this.error = getErrorMessage(error);
        } finally {
            this.ready = true;
        }
    }

    private async restoreSession() {
        const storedToken = readStoredToken();
        if (!storedToken || storedToken.expiresAt <= Date.now() + REFRESH_MARGIN_MS) {
            sessionStorage.removeItem(STORAGE_KEY);
            return;
        }

        gapi.client.setToken({access_token: storedToken.accessToken});
        this.expiresAt = storedToken.expiresAt;

        try {
            await this.loadProfile();
            this.authenticated = true;
            this.scheduleRefresh();
        } catch {
            this.clearSession();
        }
    }

    private requestToken(prompt: string): Promise<void> {
        if (!this.tokenClient) {
            return Promise.reject(new Error('Google OAuth is not configured.'));
        }

        return new Promise((resolve, reject) => {
            this.rejectTokenRequest = reject;
            this.tokenClient!.callback = (response) => {
                this.rejectTokenRequest = undefined;
                if (response.error || !response.access_token) {
                    reject(new Error(response.error_description || response.error || 'Google sign-in was cancelled.'));
                    return;
                }

                const expiresIn = response.expires_in ?? 3600;
                this.expiresAt = Date.now() + expiresIn * 1000;
                gapi.client.setToken({access_token: response.access_token});
                sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
                    accessToken: response.access_token,
                    expiresAt: this.expiresAt,
                } satisfies StoredToken));
                resolve();
            };
            try {
                this.tokenClient!.requestAccessToken({prompt});
            } catch (error) {
                this.rejectTokenRequest = undefined;
                reject(error);
            }
        });
    }

    private async loadProfile() {
        const response = await gapi.client.gmail.users.getProfile({userId: 'me'});
        if (!response.result.emailAddress) {
            throw new Error('Google did not return an email address for this account.');
        }

        this.profile = {emailAddress: response.result.emailAddress};
    }

    private scheduleRefresh() {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }

        const delay = Math.max(this.expiresAt - Date.now() - REFRESH_MARGIN_MS, 0);
        this.refreshTimer = setTimeout(async () => {
            try {
                await this.requestToken('');
                await this.loadProfile();
                this.scheduleRefresh();
            } catch {
                this.clearSession();
                this.error = 'Your Google session expired. Please sign in again.';
            }
        }, delay);
    }

    private clearSession() {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = undefined;
        }
        sessionStorage.removeItem(STORAGE_KEY);
        gapi.client.setToken(null);
        this.expiresAt = 0;
        this.profile = undefined;
        this.authenticated = false;
    }
}

function readStoredToken(): StoredToken | undefined {
    const value = sessionStorage.getItem(STORAGE_KEY);
    if (!value) {
        return undefined;
    }

    try {
        const parsed = JSON.parse(value) as Partial<StoredToken>;
        if (typeof parsed.accessToken === 'string' && typeof parsed.expiresAt === 'number') {
            return {accessToken: parsed.accessToken, expiresAt: parsed.expiresAt};
        }
    } catch {
        // Invalid session data is discarded below.
    }

    sessionStorage.removeItem(STORAGE_KEY);
    return undefined;
}

function loadScript(id: string, source: string, isLoaded: () => boolean): Promise<void> {
    if (isLoaded()) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        const existingScript = document.getElementById(id) as HTMLScriptElement | null;
        const script = existingScript ?? document.createElement('script');

        script.addEventListener('load', () => resolve(), {once: true});
        script.addEventListener('error', () => reject(new Error(`Could not load ${source}.`)), {once: true});

        if (!existingScript) {
            script.id = id;
            script.src = source;
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
        }
    });
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === 'object' && error !== null) {
        const candidate = error as {message?: unknown; type?: unknown};
        if (typeof candidate.message === 'string') {
            return candidate.message;
        }
        if (typeof candidate.type === 'string') {
            return `Google sign-in failed: ${candidate.type}.`;
        }
    }

    return 'Google sign-in failed. Please try again.';
}

declare global {
    interface Window {
        gapi?: typeof gapi;
        google?: GoogleIdentityServices;
    }
}
