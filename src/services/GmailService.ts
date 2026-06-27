export interface ParsedMessage {
    id?: string;
    sender?: string;
    subject?: string;
    date?: string;
    preview: string;
    html?: string;
    text?: string;
}

export interface MessagePage {
    messages: ParsedMessage[];
    nextPageToken?: string;
}

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

const metadataHeaders = ['From', 'Subject', 'Date'];

export async function listMessagePage(pageToken?: string): Promise<MessagePage> {
    try {
        const listResponse = await gapi.client.gmail.users.messages.list({
            userId: 'me',
            maxResults: 25,
            pageToken,
        });

        const messageRefs = listResponse.result.messages ?? [];
        const messages = await Promise.all(messageRefs.filter((message) => message.id).map(async (message) => {
            const fullMessage = await gapi.client.gmail.users.messages.get({
                userId: 'me',
                id: message.id!,
                format: 'full',
                metadataHeaders,
            });

            return parseMessage(fullMessage.result);
        }));

        return {
            messages,
            nextPageToken: listResponse.result.nextPageToken,
        };
    } catch (error) {
        throw new GmailApiError(error);
    }
}

export function parseMessage(message: gapi.client.gmail.Message): ParsedMessage {
    const htmlBodies: string[] = [];
    const textBodies: string[] = [];

    collectMessageBodies(message.payload, htmlBodies, textBodies);

    return {
        id: message.id,
        sender: getHeader(message, 'From'),
        subject: getHeader(message, 'Subject'),
        date: getHeader(message, 'Date'),
        preview: decodeHtmlEntities(message.snippet ?? '').substring(0, 200),
        html: htmlBodies.join('<hr>') || undefined,
        text: textBodies.join('\n\n') || undefined,
    };
}

export function formatError(error: unknown): string {
    if (error instanceof GmailApiError) {
        return error.isAuthError
            ? 'Authorization failed. Please sign in again or grant Gmail access.'
            : error.message;
    }

    return getErrorMessage(error);
}

function collectMessageBodies(
    part: gapi.client.gmail.MessagePart | undefined,
    htmlBodies: string[],
    textBodies: string[],
) {
    if (!part) {
        return;
    }

    if (part.mimeType === 'text/html' && part.body?.data) {
        htmlBodies.push(decodeBase64Url(part.body.data));
    }

    if (part.mimeType === 'text/plain' && part.body?.data) {
        textBodies.push(decodeBase64Url(part.body.data));
    }

    for (const childPart of part.parts ?? []) {
        collectMessageBodies(childPart, htmlBodies, textBodies);
    }
}

function getHeader(message: gapi.client.gmail.Message, name: string): string | undefined {
    return message.payload?.headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value;
}

function decodeBase64Url(value: string): string {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(base64 + padding);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

    return new TextDecoder().decode(bytes);
}

function decodeHtmlEntities(value: string): string {
    const textArea = document.createElement('textarea');
    textArea.innerHTML = value;
    return textArea.value;
}

function getErrorStatus(error: unknown): number | undefined {
    if (!isObject(error)) {
        return undefined;
    }

    const result = error.result;
    if (isObject(result) && typeof result.error === 'object' && result.error !== null) {
        const resultError = result.error as { code?: unknown };
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
            const resultError = result.error as { message?: unknown };
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
