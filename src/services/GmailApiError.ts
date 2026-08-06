export class GmailApiError extends Error {
    public readonly status?: number;
    public readonly isAuthError: boolean;

    constructor(error: unknown) {
        super(getErrorMessage(error));
        this.name = 'GmailApiError';
        this.status = getErrorStatus(error);
        this.isAuthError = this.status === 401 || this.status === 403;
    }
}

export function formatError(error: unknown): string {
    if (error instanceof GmailApiError) {
        return error.isAuthError
            ? 'Authorization failed. Please sign in again or grant Gmail access.'
            : error.message;
    }

    return getErrorMessage(error);
}

function getErrorStatus(error: unknown): number | undefined {
    if (!isObject(error)) {
        return undefined;
    }

    const result = error.result;
    if (isObject(result) && typeof result.error === 'object' && result.error !== null) {
        const resultError = result.error as {code?: unknown};
        return typeof resultError.code === 'number' ? resultError.code : undefined;
    }

    return typeof error.status === 'number' ? error.status : undefined;
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }

    if (isObject(error)) {
        const result = error.result;
        if (isObject(result) && typeof result.error === 'object' && result.error !== null) {
            const resultError = result.error as {message?: unknown};
            if (typeof resultError.message === 'string') {
                return resultError.message;
            }
        }

        if (typeof error.message === 'string') {
            return error.message;
        }
    }

    return 'Unexpected Gmail API error.';
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
