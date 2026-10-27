import {SvelteMap, SvelteSet} from 'svelte/reactivity';
import {applyLabelMutation, type MessageMutation} from '../MessageMutation';
import type {ActionableMessage, BundleSummary, MessageListOptions, ParsedMessage} from './GmailService';

type CachedMessage = ActionableMessage & Partial<ParsedMessage>;

export interface MessageRead {
    generation: number;
    revision: number;
    sequence: number;
    pendingIds: Set<string>;
}

interface PendingChange {
    ids: string[];
    mutation: MessageMutation;
}

export class MessageQuery {
    readSequence = 0;
    loaded = $state(false);
    revision = $state(0);
    ids: string[] = $state([]);
    nextPageToken: string | undefined = $state();
    refreshVersion = $state(0);

    constructor(readonly options: MessageListOptions) {}
}

/** Shared mailbox data. Views project pending mutations over the confirmed data. */
export class MessageStore {
    private confirmed = new SvelteMap<string, CachedMessage>();
    private pending = new SvelteMap<number, PendingChange>();
    private deleted = new SvelteSet<string>();
    private queries = new Map<string, MessageQuery>();
    private revisions = new Map<string, number>();
    private readSequences = new Map<string, number>();
    // Needed when a mutation finishes before a previously unseen message is loaded.
    private committedChanges = new Map<string, {revision: number; mutation: MessageMutation}[]>();
    private account?: string;
    private accountGeneration = 0;
    private revision = 0;
    private sequence = 0;
    private nextOperationId = 0;

    get generation() {
        return this.accountGeneration;
    }

    setAccount(account?: string) {
        const normalized = account?.toLowerCase();
        if (normalized === this.account) return;
        this.account = normalized;
        this.accountGeneration += 1;
        this.confirmed.clear();
        this.pending.clear();
        this.deleted.clear();
        this.queries.clear();
        this.revisions.clear();
        this.readSequences.clear();
        this.committedChanges.clear();
    }

    query(options: MessageListOptions): MessageQuery {
        const {pageToken: _pageToken, ...filters} = options;
        const key = JSON.stringify(filters);
        let query = this.queries.get(key);
        if (!query) {
            query = new MessageQuery(filters);
            this.queries.set(key, query);
        }
        return query;
    }

    beginRead(): MessageRead {
        return {
            generation: this.generation,
            revision: this.revision,
            sequence: ++this.sequence,
            pendingIds: new Set([...this.pending.values()].flatMap((change) => change.ids)),
        };
    }

    ingest(messages: CachedMessage[], read: MessageRead): boolean {
        if (read.generation !== this.generation) return false;
        for (const message of messages) {
            if (message.bundleSummary) {
                for (const member of message.bundleSummary.messages) this.ingestMessage(member, read);
            }
            this.ingestMessage(message, read);
        }
        return true;
    }

    private ingestMessage(message: CachedMessage, read: MessageRead) {
        if (!message.id) return;
        const existing = this.confirmed.get(message.id);
        const stale = (this.revisions.get(message.id) ?? 0) > read.revision
            || read.pendingIds.has(message.id)
            || (this.readSequences.get(message.id) ?? 0) > read.sequence;
        let labelIds = message.labelIds;
        if (stale && existing) {
            labelIds = existing.labelIds;
        } else if (stale) {
            for (const change of this.committedChanges.get(message.id) ?? []) {
                if (change.revision > read.revision) {
                    labelIds = applyLabelMutation(labelIds, change.mutation);
                }
            }
        }
        const outOfOrder = (this.readSequences.get(message.id) ?? 0) > read.sequence;
        this.confirmed.set(message.id, withLabels(outOfOrder ? {...message, ...existing} : {...existing, ...message}, labelIds));
        this.readSequences.set(message.id, Math.max(read.sequence, this.readSequences.get(message.id) ?? 0));
        if (!stale) this.committedChanges.delete(message.id);
    }

    getActionable(id: string): CachedMessage | undefined {
        let message = this.confirmed.get(id);
        if (!message || this.deleted.has(id)) return undefined;
        for (const change of this.pending.values()) {
            if (!change.ids.includes(id)) continue;
            if (change.mutation.kind === 'delete') return undefined;
            message = withLabels(message, applyLabelMutation(message.labelIds, change.mutation));
        }
        return message;
    }

    getMessage(id: string): ParsedMessage | undefined {
        const message = this.getActionable(id);
        if (!message || typeof message.preview !== 'string') return undefined;
        if (!message.bundleSummary) return message as ParsedMessage;
        return {...message, bundleSummary: this.projectSummary(message.bundleSummary)} as ParsedMessage;
    }

    private projectSummary(summary: BundleSummary): BundleSummary {
        const members = summary.messages.flatMap((member) => {
            const current = member.id ? this.getActionable(member.id) : member;
            return current ? [current] : [];
        });
        return {
            messages: members,
            count: Math.min(25, members.length),
            hasMore: members.length > 25,
            senders: members.slice(0, 25).map((member) =>
                'sender' in member && typeof member.sender === 'string' && member.sender ? member.sender : 'Unknown sender'),
        };
    }

    private bundleFor(id: string, options: MessageListOptions): ParsedMessage | undefined {
        const cached = this.confirmed.get(id);
        if (!cached?.bundleLabelId || !cached.bundleSummary || typeof cached.preview !== 'string') return undefined;
        const summary = this.projectSummary(cached.bundleSummary);
        const representative = summary.messages.find((member) => matchesQuery(member, options));
        if (!representative) return undefined;
        const fullMessage = representative.id ? this.confirmed.get(representative.id) : undefined;
        // A bundle can outlive its original representative. Metadata is enough to
        // keep its row visible until the replacement message's body is fetched.
        return {
            ...cached,
            ...fullMessage,
            ...representative,
            bundleLabelId: cached.bundleLabelId,
            bundleTitle: cached.bundleTitle,
            bundleSummary: summary,
        } as ParsedMessage;
    }

    messagesFor(query: MessageQuery): ParsedMessage[] {
        // Arbitrary Gmail searches keep server-provided membership and refresh after writes.
        const serverMembership = Boolean(query.options.query && query.options.query !== 'in:archive');
        const localIds = [...this.confirmed.keys()].filter((id) => !query.loaded
            || (this.revisions.get(id) ?? 0) > query.revision || this.isPending([id]));
        const ids = serverMembership ? query.ids : [...new Set([...query.ids, ...localIds])];
        return ids.flatMap((id) => {
            if (query.options.includeBundleSummaries !== false) {
                const bundle = this.bundleFor(id, query.options);
                if (bundle) return [bundle];
            }
            const message = this.getMessage(id);
            return message && matchesQuery(message, query.options) ? [message] : [];
        });
    }

    isPending(ids: string[]): boolean {
        const targets = new Set(ids);
        return [...this.pending.values()].some((change) => change.ids.some((id) => targets.has(id)));
    }

    begin(ids: string[], mutation: MessageMutation): number {
        if (this.isPending(ids)) throw new Error('An action is already pending for one of these messages.');
        const operationId = ++this.nextOperationId;
        this.pending.set(operationId, {ids: [...new Set(ids)], mutation});
        this.touch(ids);
        return operationId;
    }

    setTargets(operationId: number, ids: string[]) {
        const change = this.pending.get(operationId);
        if (!change) return;
        const others = [...this.pending].filter(([id]) => id !== operationId);
        if (others.some(([, other]) => other.ids.some((id) => ids.includes(id)))) {
            throw new Error('An action is already pending for one of these messages.');
        }
        this.touch([...change.ids, ...ids]);
        this.pending.set(operationId, {...change, ids: [...new Set(ids)]});
    }

    commit(operationId: number, ids: string[], labels?: ReadonlyMap<string, string[]>) {
        const change = this.pending.get(operationId);
        if (!change) return;
        this.touch(ids);
        for (const id of ids) {
            if (change.mutation.kind === 'delete') this.deleted.add(id);
            const message = this.confirmed.get(id);
            const serverLabels = labels?.get(id);
            if (message || serverLabels) {
                this.confirmed.set(id, withLabels(message ?? {id, labelIds: [], starred: false, unread: false},
                    serverLabels ?? applyLabelMutation(message!.labelIds, change.mutation)));
            }
            const history = this.committedChanges.get(id) ?? [];
            this.committedChanges.set(id, [...history, {revision: this.revision, mutation: change.mutation}]);
        }
        this.removeTargets(operationId, ids);
    }

    rollback(operationId: number) {
        const change = this.pending.get(operationId);
        if (!change) return;
        this.touch(change.ids);
        this.pending.delete(operationId);
    }

    invalidateSearches() {
        for (const query of this.queries.values()) {
            if (query.options.query && query.options.query !== 'in:archive') query.refreshVersion += 1;
        }
    }

    renameBundle(labelId: string, title: string) {
        for (const [id, message] of this.confirmed) {
            if (message.bundleLabelId === labelId) this.confirmed.set(id, {...message, bundleTitle: title});
        }
    }

    markMissing(id: string, read: MessageRead) {
        if (read.generation !== this.generation || (this.revisions.get(id) ?? 0) > read.revision
            || read.pendingIds.has(id) || this.isPending([id])) return;
        this.deleted.add(id);
    }

    private removeTargets(operationId: number, ids: string[]) {
        const change = this.pending.get(operationId)!;
        const completed = new Set(ids);
        const remaining = change.ids.filter((id) => !completed.has(id));
        if (remaining.length) this.pending.set(operationId, {...change, ids: remaining});
        else this.pending.delete(operationId);
    }

    private touch(ids: string[]) {
        this.revision += 1;
        ids.forEach((id) => this.revisions.set(id, this.revision));
    }
}

function withLabels(message: CachedMessage, labelIds: string[]): CachedMessage {
    return {...message, labelIds, starred: labelIds.includes('STARRED'), unread: labelIds.includes('UNREAD')};
}

function matchesQuery(message: ActionableMessage, options: MessageListOptions): boolean {
    if (options.labelIds?.some((label) => !message.labelIds.includes(label))) return false;
    if (options.query === 'in:archive' && message.labelIds.includes('INBOX')) return false;
    if (options.query && options.query !== 'in:archive') return true;
    const explicitlyIncludesHidden = options.labelIds?.some((label) => label === 'SPAM' || label === 'TRASH');
    return Boolean(options.includeSpamTrash || explicitlyIncludesHidden)
        || !message.labelIds.some((label) => label === 'SPAM' || label === 'TRASH');
}
