import type {MessageAction} from "../MessageActions";
import {formatError} from "./GmailService";
import type {ToastService} from "./ToastService.svelte";

type MessageIdSource = string[] | (() => Promise<string[]>);

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
        this.pendingOperations += 1;
        try {
            return await operation();
        } finally {
            this.pendingOperations -= 1;
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
            return await this.run(async () => {
                const resolvedIds = typeof messageIds === 'function'
                    ? await messageIds()
                    : messageIds;
                const uniqueIds = [...new Set(resolvedIds)];
                if (!uniqueIds.length || (action.confirm && !action.confirm(uniqueIds.length))) {
                    return false;
                }

                if (action.onBulkAction) {
                    await action.onBulkAction(uniqueIds);
                } else {
                    await Promise.all(uniqueIds.map(action.onAction));
                }
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
