import type {MessageAction} from "../MessageActions";
import {
    batchModifyMessageLabels, deleteMessageForever, formatError, getThreadMessages,
    GmailApiError, listMessagePage, moveMessageToTrash, restoreMessageFromTrash,
    type ParsedMessage,
} from "./GmailService";
import type {ToastService} from "./ToastService.svelte";
import type {MessageQuery, MessageStore} from "./MessageStore.svelte";
import type {MessageMutation} from "../MessageMutation";

type MessageIdSource = string[] | (() => Promise<string[]>);

interface OptimisticOptions {
    optimisticIds?: string[];
    onOptimistic?: () => void;
}

const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY_MS = 500;

export class GmailOperationService {
    private pendingOperations = $state(0);
    constructor(
        private readonly toastService: ToastService,
        public readonly messages: MessageStore,
    ) {}

    public get busy() {
        return this.pendingOperations > 0;
    }

    public setAccount(account?: string) {
        this.messages.setAccount(account);
    }

    public isPending(messageIds: string[]) {
        return this.messages.isPending(messageIds);
    }

    public async run<T>(operation: () => Promise<T>): Promise<T> {
        const generation = this.messages.generation;
        return this.track(() => this.runWithRetry(operation, generation));
    }

    public async loadMessagePage(query: MessageQuery, pageToken?: string) {
        const read = this.messages.beginRead();
        query.readSequence = read.sequence;
        const page = await this.run(() => listMessagePage({...query.options, pageToken}));
        if (query.readSequence !== read.sequence || !this.messages.ingest(page.messages, read)) return;
        const fetchedIds = page.messages.flatMap(({id}) => id ? [id] : []);
        const retainedIds = pageToken ? query.ids : query.ids.filter((id) =>
            read.pendingIds.has(id) || this.messages.isPending([id]));
        query.ids = [...new Set([...retainedIds, ...fetchedIds])];
        query.nextPageToken = page.nextPageToken;
        if (!pageToken) query.revision = read.revision;
        query.loaded = true;
    }

    public async loadThread(message: ParsedMessage): Promise<string[]> {
        const read = this.messages.beginRead();
        const messages = await this.run(() => getThreadMessages(message));
        this.messages.ingest(messages, read);
        return messages.flatMap(({id}) => id ? [id] : []);
    }

    private async track<T>(operation: () => Promise<T>): Promise<T> {
        this.pendingOperations += 1;
        try {
            return await operation();
        } finally {
            this.pendingOperations -= 1;
        }
    }

    private async runWithRetry<T>(operation: () => Promise<T>, generation: number): Promise<T> {
        for (let attempt = 0; ; attempt += 1) {
            this.assertCurrentAccount(generation);
            try {
                const result = await operation();
                this.assertCurrentAccount(generation);
                return result;
            } catch (error) {
                this.assertCurrentAccount(generation);
                if (attempt >= MAX_RETRIES || !isRetryable(error)) {
                    throw error;
                }
                await delay(INITIAL_RETRY_DELAY_MS * 2 ** attempt);
            }
        }
    }

    public runMessageAction(action: MessageAction, messageId: string, options?: OptimisticOptions) {
        return this.runBulkMessageAction(action, [messageId], options);
    }

    public async runBulkMessageAction(
        action: MessageAction,
        messageIds: MessageIdSource,
        options: OptimisticOptions = {},
    ): Promise<boolean> {
        const generation = this.messages.generation;
        const previewIds = typeof messageIds === 'function' ? options.optimisticIds ?? [] : messageIds;
        if (this.isPending(previewIds)) return false;
        return this.track(async () => {
            let operationId: number | undefined;
            try {
                // Bundle discovery can run after known, visible messages have changed.
                // Destructive confirmation waits for the exact target count first.
                if (typeof messageIds === 'function' && !action.confirm) {
                    operationId = this.messages.begin(previewIds, action.mutation);
                    options.onOptimistic?.();
                }
                const resolvedIds = typeof messageIds === 'function'
                    ? await this.runWithRetry(messageIds, generation)
                    : messageIds;
                const uniqueIds = [...new Set(resolvedIds)];
                if (!uniqueIds.length || (action.confirm && !action.confirm(uniqueIds.length))) {
                    return false;
                }
                this.assertCurrentAccount(generation);
                if (operationId === undefined) {
                    operationId = this.messages.begin(uniqueIds, action.mutation);
                    options.onOptimistic?.();
                } else {
                    this.messages.setTargets(operationId, uniqueIds);
                }

                const failures: {ids: string[]; error: unknown}[] = [];
                const execute = async (ids: string[]) => {
                    try {
                        const labels = await this.runWithRetry(() => executeMutation(ids, action.mutation), generation);
                        this.messages.commit(operationId!, ids, labels);
                    } catch (error) {
                        failures.push({ids, error});
                    }
                };
                if (action.mutation.kind === 'labels') {
                    for (let index = 0; index < uniqueIds.length; index += 1000) {
                        this.assertCurrentAccount(generation);
                        await execute(uniqueIds.slice(index, index + 1000));
                    }
                } else {
                    for (let index = 0; index < uniqueIds.length; index += 25) {
                        this.assertCurrentAccount(generation);
                        await Promise.all(uniqueIds.slice(index, index + 25).map((id) => execute([id])));
                    }
                }
                this.assertCurrentAccount(generation);
                this.messages.rollback(operationId);
                if (failures.length) {
                    const failedIds = failures.flatMap((failure) => failure.ids);
                    this.toastService.error({
                        message: `Failed to ${action.label.toLowerCase()} (${failedIds.length} of ${uniqueIds.length} messages)`,
                        error: formatError(failures[0].error),
                    });
                    // A lost response may hide a successful server write. Reconcile only
                    // uncertain outcomes, after the optimistic state has been rolled back.
                    const uncertainIds = failures.filter(({error}) => isRetryable(error)).flatMap(({ids}) => ids);
                    if (uncertainIds.length) await this.reconcile(uncertainIds, generation);
                }
                return failures.length === 0;
            } catch (error) {
                if (generation === this.messages.generation) {
                    this.toastService.error({message: `Failed to ${action.label.toLowerCase()}`, error: formatError(error)});
                }
                return false;
            } finally {
                if (generation === this.messages.generation) {
                    if (operationId !== undefined) this.messages.rollback(operationId);
                    this.messages.invalidateSearches();
                }
            }
        });
    }

    private assertCurrentAccount(generation: number) {
        if (generation !== this.messages.generation) throw new Error('The active Gmail account changed.');
    }

    private async reconcile(ids: string[], generation: number) {
        const read = this.messages.beginRead();
        for (let index = 0; index < ids.length; index += 25) {
            this.assertCurrentAccount(generation);
            await Promise.all(ids.slice(index, index + 25).map(async (id) => {
                try {
                    const response = await gapi.client.gmail.users.messages.get({userId: 'me', id, format: 'minimal'});
                    this.assertCurrentAccount(generation);
                    this.messages.ingest([{id, labelIds: response.result.labelIds ?? [], starred: false, unread: false}], read);
                } catch (error) {
                    const apiError = error instanceof GmailApiError ? error : new GmailApiError(error);
                    if (apiError.status === 404) {
                        this.messages.markMissing(id, read);
                    }
                    // Retain the rolled-back state if reconciliation is also unavailable.
                }
            }));
        }
    }
}

async function executeMutation(ids: string[], mutation: MessageMutation): Promise<Map<string, string[]>> {
    const labels = new Map<string, string[]>();
    if (mutation.kind === 'labels') {
        await batchModifyMessageLabels(ids, mutation.addLabelIds, mutation.removeLabelIds);
    } else if (mutation.kind === 'delete') {
        try {
            await deleteMessageForever(ids[0]);
        } catch (error) {
            // Retrying a deletion whose response was lost can return "not found".
            if (!(error instanceof GmailApiError) || error.status !== 404) throw error;
        }
    } else {
        const result = mutation.kind === 'trash'
            ? await moveMessageToTrash(ids[0])
            : await restoreMessageFromTrash(ids[0]);
        if (result) labels.set(ids[0], result);
    }
    return labels;
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
    return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}
