import type {MessageAction} from "../MessageActions";
import {formatError} from "./GmailService";
import type {ToastService} from "./ToastService.svelte";

type MessageIdSource = string[] | (() => Promise<string[]>);

export class MessageActionService {
    public busy = $state(false);

    constructor(private readonly toastService: ToastService) {}

    public run(action: MessageAction, messageId: string) {
        return this.runBulk(action, [messageId]);
    }

    public async runBulk(action: MessageAction, messageIds: MessageIdSource): Promise<boolean> {
        if (this.busy) {
            return false;
        }

        this.busy = true;
        try {
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
        } catch (error) {
            this.toastService.error({
                message: `Failed to ${action.label.toLowerCase()}`,
                error: formatError(error),
            });
            return false;
        } finally {
            this.busy = false;
        }
    }
}
