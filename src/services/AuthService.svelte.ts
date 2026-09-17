import type {GmailOperationService} from "./GmailOperationService.svelte";

export interface AccountProfile {
    emailAddress: string;
}

interface StoredToken {
    accessToken: string;
    expiresAt: number;
}

interface StoredAccount extends StoredToken, AccountProfile {}

interface StoredAccounts {
    activeEmailAddress?: string;
    accounts: StoredAccount[];
}

interface TokenResponse {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
}

interface TokenClient {
    callback: (response: TokenResponse) => void;
    requestAccessToken: (options: {prompt: string, login_hint?: string}) => void;
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
const SCOPES = [
    'https://mail.google.com/',
    'https://www.googleapis.com/auth/contacts.readonly',
].join(' ');
const STORAGE_KEY = 'fettuccemail.google-accounts.v3';
const PREVIOUS_STORAGE_KEY = 'fettuccemail.google-token.v2';
const LEGACY_STORAGE_KEY = 'fettuccemail.google-token';
const REFRESH_MARGIN_MS = 60_000;

export class AuthService {
    public ready = $state(false);
    public busy = $state(false);
    public authenticated = $state(false);
    public profile: AccountProfile | undefined = $state();
    public accounts: AccountProfile[] = $state([]);
    public error: string | undefined = $state();

    private tokenClient: TokenClient | undefined;
    private readonly accountTokens = new Map<string, StoredToken>();
    private expiresAt = 0;
    private refreshTimer: ReturnType<typeof setTimeout> | undefined;
    private initialization: Promise<void> | undefined;
    private rejectTokenRequest: ((reason: Error) => void) | undefined;

    constructor(private readonly gmailOperations: GmailOperationService) {}

    public initialize(): Promise<void> {
        if (!this.initialization) {
            this.initialization = this.initializeGoogleApis();
        }

        return this.initialization;
    }

    public async signIn(): Promise<boolean> {
        if (this.busy) {
            return false;
        }

        this.busy = true;
        this.error = undefined;

        try {
            await this.initialize();
            const token = await this.requestToken('');
            const profile = await this.loadProfile();
            this.activateAccount(profile, token);
            return true;
        } catch (error) {
            this.deactivateSession();
            this.persistAccounts();
            this.error = getErrorMessage(error);
            return false;
        } finally {
            this.busy = false;
        }
    }

    public async addAccount(): Promise<boolean> {
        if (this.busy) {
            return false;
        }

        const currentProfile = this.profile;
        const currentToken = currentProfile
            ? this.accountTokens.get(accountKey(currentProfile.emailAddress))
            : undefined;

        this.busy = true;
        this.error = undefined;

        try {
            await this.initialize();
            const token = await this.requestToken('select_account');
            const profile = await this.loadProfile();
            this.activateAccount(profile, token);
            return true;
        } catch (error) {
            this.restoreAccount(currentProfile, currentToken);
            this.error = getErrorMessage(error);
            return false;
        } finally {
            this.busy = false;
        }
    }

    public async switchAccount(emailAddress: string): Promise<boolean> {
        if (this.busy || accountKey(emailAddress) === accountKey(this.profile?.emailAddress ?? '')) {
            return !this.busy;
        }

        const target = this.accounts.find((account) =>
            accountKey(account.emailAddress) === accountKey(emailAddress)
        );
        if (!target) {
            this.error = 'That account is no longer signed in.';
            return false;
        }

        const targetToken = this.accountTokens.get(accountKey(target.emailAddress));
        const currentProfile = this.profile;
        const currentToken = currentProfile
            ? this.accountTokens.get(accountKey(currentProfile.emailAddress))
            : undefined;

        this.busy = true;
        this.error = undefined;

        try {
            if (targetToken && targetToken.expiresAt > Date.now() + REFRESH_MARGIN_MS) {
                this.activateAccount(target, targetToken);
                return true;
            }

            await this.initialize();
            const refreshedToken = await this.requestToken('', target.emailAddress);
            const refreshedProfile = await this.loadProfile();
            if (accountKey(refreshedProfile.emailAddress) !== accountKey(target.emailAddress)) {
                throw new Error(`Google signed in ${refreshedProfile.emailAddress} instead of ${target.emailAddress}.`);
            }

            this.activateAccount(refreshedProfile, refreshedToken);
            return true;
        } catch (error) {
            this.restoreAccount(currentProfile, currentToken);
            this.error = getErrorMessage(error);
            return false;
        } finally {
            this.busy = false;
        }
    }

    public async signOut() {
        if (this.busy) {
            return;
        }

        const currentProfile = this.profile;
        if (!currentProfile) {
            this.deactivateSession();
            return;
        }

        this.busy = true;
        const key = accountKey(currentProfile.emailAddress);
        const accessToken = this.accountTokens.get(key)?.accessToken;

        this.accountTokens.delete(key);
        this.accounts = this.accounts.filter((account) => accountKey(account.emailAddress) !== key);

        if (!this.activateNextAvailableAccount()) {
            this.deactivateSession();
            this.persistAccounts();
        }

        try {
            if (accessToken && window.google?.accounts.oauth2) {
                await new Promise<void>((resolve) => {
                    window.google!.accounts.oauth2.revoke(accessToken, resolve);
                });
            }
        } finally {
            this.busy = false;
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
            sessionStorage.removeItem(LEGACY_STORAGE_KEY);
            sessionStorage.removeItem(PREVIOUS_STORAGE_KEY);
        } catch (error) {
            this.error = getErrorMessage(error);
        } finally {
            this.ready = true;
        }
    }

    private async restoreSession() {
        const storedAccounts = readStoredAccounts();
        if (storedAccounts) {
            this.accounts = storedAccounts.accounts.map(({emailAddress}) => ({emailAddress}));
            for (const account of storedAccounts.accounts) {
                this.accountTokens.set(accountKey(account.emailAddress), {
                    accessToken: account.accessToken,
                    expiresAt: account.expiresAt,
                });
            }

            const preferredKey = accountKey(storedAccounts.activeEmailAddress ?? '');
            const candidates = [...this.accounts].sort((left, right) =>
                Number(accountKey(right.emailAddress) === preferredKey)
                - Number(accountKey(left.emailAddress) === preferredKey)
            );

            for (const account of candidates) {
                const key = accountKey(account.emailAddress);
                const token = this.accountTokens.get(key);
                if (!token || token.expiresAt <= Date.now() + REFRESH_MARGIN_MS) {
                    continue;
                }

                gapi.client.setToken({access_token: token.accessToken});
                try {
                    const profile = await this.loadProfile();
                    if (accountKey(profile.emailAddress) !== key) {
                        this.accountTokens.delete(key);
                        this.accounts = this.accounts.filter((candidate) =>
                            accountKey(candidate.emailAddress) !== key
                        );
                    }
                    this.activateAccount(profile, token);
                    return;
                } catch {
                    this.accountTokens.delete(key);
                    this.accounts = this.accounts.filter((candidate) =>
                        accountKey(candidate.emailAddress) !== key
                    );
                }
            }

            this.deactivateSession();
            this.persistAccounts();
            return;
        }

        const storedToken = readStoredToken(PREVIOUS_STORAGE_KEY);
        if (!storedToken || storedToken.expiresAt <= Date.now() + REFRESH_MARGIN_MS) {
            sessionStorage.removeItem(PREVIOUS_STORAGE_KEY);
            return;
        }

        gapi.client.setToken({access_token: storedToken.accessToken});

        try {
            const profile = await this.loadProfile();
            this.activateAccount(profile, storedToken);
        } catch {
            this.deactivateSession();
        }
    }

    private requestToken(prompt: string, loginHint?: string): Promise<StoredToken> {
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
                const token = {
                    accessToken: response.access_token,
                    expiresAt: Date.now() + expiresIn * 1000,
                } satisfies StoredToken;
                gapi.client.setToken({access_token: response.access_token});
                resolve(token);
            };
            try {
                this.tokenClient!.requestAccessToken({prompt, login_hint: loginHint});
            } catch (error) {
                this.rejectTokenRequest = undefined;
                reject(error);
            }
        });
    }

    private async loadProfile(): Promise<AccountProfile> {
        const response = await this.gmailOperations.run(() =>
            gapi.client.gmail.users.getProfile({userId: 'me'})
        );
        if (!response.result.emailAddress) {
            throw new Error('Google did not return an email address for this account.');
        }

        return {emailAddress: response.result.emailAddress};
    }

    private scheduleRefresh() {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }

        const activeEmailAddress = this.profile?.emailAddress;
        if (!activeEmailAddress) {
            return;
        }

        const delay = Math.max(this.expiresAt - Date.now() - REFRESH_MARGIN_MS, 0);
        this.refreshTimer = setTimeout(async () => {
            if (accountKey(this.profile?.emailAddress ?? '') !== accountKey(activeEmailAddress)) {
                return;
            }

            try {
                const token = await this.requestToken('', activeEmailAddress);
                const profile = await this.loadProfile();
                if (accountKey(profile.emailAddress) !== accountKey(activeEmailAddress)) {
                    throw new Error('Google refreshed the wrong account.');
                }
                this.activateAccount(profile, token);
            } catch {
                if (!this.activateNextAvailableAccount(activeEmailAddress)) {
                    this.deactivateSession();
                    this.persistAccounts();
                }
                this.error = 'Your Google session expired. Please sign in again.';
            }
        }, delay);
    }

    private activateAccount(profile: AccountProfile, token: StoredToken) {
        const key = accountKey(profile.emailAddress);
        const existingIndex = this.accounts.findIndex((account) => accountKey(account.emailAddress) === key);

        this.accountTokens.set(key, token);
        if (existingIndex === -1) {
            this.accounts = [...this.accounts, profile];
        } else if (this.accounts[existingIndex].emailAddress !== profile.emailAddress) {
            this.accounts = this.accounts.map((account, index) => index === existingIndex ? profile : account);
        }

        gapi.client.setToken({access_token: token.accessToken});
        this.expiresAt = token.expiresAt;
        this.profile = profile;
        this.authenticated = true;
        this.persistAccounts();
        this.scheduleRefresh();
    }

    private restoreAccount(profile?: AccountProfile, token?: StoredToken) {
        if (profile && token && token.expiresAt > Date.now() + REFRESH_MARGIN_MS) {
            this.activateAccount(profile, token);
        } else {
            this.deactivateSession();
            this.persistAccounts();
        }
    }

    private activateNextAvailableAccount(excludedEmailAddress?: string): boolean {
        const excludedKey = accountKey(excludedEmailAddress ?? '');
        const nextAccount = this.accounts.find((account) => {
            const key = accountKey(account.emailAddress);
            const token = this.accountTokens.get(key);
            return key !== excludedKey && token && token.expiresAt > Date.now() + REFRESH_MARGIN_MS;
        });
        const nextToken = nextAccount && this.accountTokens.get(accountKey(nextAccount.emailAddress));
        if (!nextAccount || !nextToken) {
            return false;
        }

        this.activateAccount(nextAccount, nextToken);
        return true;
    }

    private persistAccounts() {
        const accounts = this.accounts.flatMap((account): StoredAccount[] => {
            const token = this.accountTokens.get(accountKey(account.emailAddress));
            return token ? [{...account, ...token}] : [];
        });

        if (!accounts.length) {
            localStorage.removeItem(STORAGE_KEY);
            return;
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            activeEmailAddress: this.profile?.emailAddress,
            accounts,
        } satisfies StoredAccounts));
    }

    private deactivateSession() {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = undefined;
        }
        gapi.client.setToken(null);
        this.expiresAt = 0;
        this.profile = undefined;
        this.authenticated = false;
    }
}

function readStoredAccounts(): StoredAccounts | undefined {
    const value = localStorage.getItem(STORAGE_KEY);
    if (!value) {
        return undefined;
    }

    try {
        const parsed = JSON.parse(value) as Partial<StoredAccounts>;
        if (Array.isArray(parsed.accounts)) {
            const seen = new Set<string>();
            const accounts = parsed.accounts.flatMap((account): StoredAccount[] => {
                if (
                    !account
                    || typeof account.emailAddress !== 'string'
                    || typeof account.accessToken !== 'string'
                    || typeof account.expiresAt !== 'number'
                ) {
                    return [];
                }

                const key = accountKey(account.emailAddress);
                if (!key || seen.has(key)) {
                    return [];
                }
                seen.add(key);
                return [{
                    emailAddress: account.emailAddress,
                    accessToken: account.accessToken,
                    expiresAt: account.expiresAt,
                }];
            });
            return {
                activeEmailAddress: typeof parsed.activeEmailAddress === 'string'
                    ? parsed.activeEmailAddress
                    : undefined,
                accounts,
            };
        }
    } catch {
        // Invalid saved account data is discarded below.
    }

    localStorage.removeItem(STORAGE_KEY);
    return undefined;
}

function readStoredToken(storageKey: string): StoredToken | undefined {
    const value = sessionStorage.getItem(storageKey);
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

    sessionStorage.removeItem(storageKey);
    return undefined;
}

function accountKey(emailAddress: string): string {
    return emailAddress.trim().toLowerCase();
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
