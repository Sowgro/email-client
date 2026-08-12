import type {MessageAction} from "../MessageActions";
import {formatError, GmailApiError} from "./GmailService";
import type {ToastService} from "./ToastService.svelte";

type MessageIdSource = string[] | (() => Promise<string[]>);

const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY_MS = 500;

export class GmailOperationService {
    private pendingOperations = $state(0);
    private messageActionRunning = $state(false);

    constructor(private readonly toastService: ToastService) {}

    public get busy() {
        return this.pendingOperations > 0;
    }

    public get messageActionBusy() {
        return this.messageActionRunning;
    }

    public async run<T>(operation: () => Promise<T>): Promise<T> {
        return this.track(() => this.runWithRetry(operation));
    }

    private async track<T>(operation: () => Promise<T>): Promise<T> {
        this.pendingOperations += 1;
        try {
            return await operation();
        } finally {
            this.pendingOperations -= 1;
        }
    }

    private async runWithRetry<T>(operation: () => Promise<T>): Promise<T> {
        for (let attempt = 0; ; attempt += 1) {
            try {
                return await operation();
            } catch (error) {
                if (attempt >= MAX_RETRIES || !isRetryable(error)) {
                    throw error;
                }
                await delay(INITIAL_RETRY_DELAY_MS * 2 ** attempt);
            }
        }
    }

    public runMessageAction(action: MessageAction, messageId: string) {
        return this.runBulkMessageAction(action, [messageId]);
    }

    public async runBulkMessageAction(
        action: MessageAction,
        messageIds: MessageIdSource,
    ): Promise<boolean> {
        if (this.messageActionRunning) {
            return false;
        }

        this.messageActionRunning = true;
        try {
            return await this.track(async () => {
                const resolvedIds = typeof messageIds === 'function'
                    ? await this.runWithRetry(messageIds)
                    : messageIds;
                const uniqueIds = [...new Set(resolvedIds)];
                if (!uniqueIds.length || (action.confirm && !action.confirm(uniqueIds.length))) {
                    return false;
                }

                await this.runWithRetry(() => action.onBulkAction
                    ? action.onBulkAction(uniqueIds)
                    : Promise.all(uniqueIds.map(action.onAction)).then(() => undefined)
                );
                return true;
            });
        } catch (error) {
            this.toastService.error({
                message: `Failed to ${action.label.toLowerCase()}`,
                error: formatError(error),
            });
            return false;
        } finally {
            this.messageActionRunning = false;
        }
    }
}

function isRetryable(error: unknown): boolean {
    const apiError = error instanceof GmailApiError
        ? error
        : new GmailApiError(error);

    if (apiError.status !== undefined) {
        return apiError.status === 0
            || apiError.status === 408
            || apiError.status === 429
            || apiError.status >= 500;
    }

    return error instanceof TypeError
        || /network|failed to fetch|timeout|timed out|connection/i.test(apiError.message);
}

function delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
