<script lang="ts">
    import {getContext, onMount, untrack, type Snippet} from "svelte";
    import {Context} from "../Context";
    import EmailListEntry from "./EmailListEntry.svelte";
    import BundleListEntry from "./BundleListEntry.svelte";
    import {
        formatError,
        type MessageListOptions,
        type ParsedMessage,
    } from "../services/GmailService";
    import {
        createBundle,
        listAllMessageIds, renameBundle,
    } from "../services/BundleService";
    import {PanelService} from "../services/PanelService.svelte";
    import {ToastService} from "../services/ToastService.svelte";
    import {GmailOperationService} from "../services/GmailOperationService.svelte";
    import {type MessageSection, sortDate, sortPinned} from "../MessageSorter";
    import {buildListItems, type BundleListItem, type EmailListItem} from "../EmailListItem";
    import {Selection} from "../Selection.svelte";
    import {
        getCommonActions,
        type MessageAction,
    } from "../MessageActions";
    import SectionHeader from "./SectionHeader.svelte";
    import {activateNextMessage, emailListNavigation} from "../emailListNavigation";
    import {MessageStore} from "../services/MessageStore.svelte";

    let {
        options,
        groupByDate = false,
        groupPins = false,
        parseBundles = true,
        bundleInfo,
        selfSnippet
    }: {
        options: MessageListOptions,
        groupByDate?: boolean,
        groupPins?: boolean,
        parseBundles?: boolean,
        bundleInfo?: BundleListItem,
        selfSnippet?: Snippet
    } = $props()

    const messageStore: MessageStore = getContext(Context.MESSAGE_STORE);
    // Filter changes mount a new list (search is keyed by its query).
    const query = untrack(() => messageStore.query(options));
    let messages = $derived(messageStore.messagesFor(query));
    let nextPageToken = $derived(query.nextPageToken);
    let loading = $state(true);
    let bundling = $state(false);
    let emailListRoot: HTMLDivElement | undefined = $state();
    let mounted = false;
    let loadSequence = 0;
    const selection = new Selection<EmailListItem>((item) => item.key);

    const getRepresentative = (item: EmailListItem) => item.kind === 'bundle'
        ? {...item.representative, starred: item.actionMessages.some((message) => message.starred)}
        : item.representative;

    const getMessageSections = (items: EmailListItem[]): MessageSection<EmailListItem>[] => {
        let r: MessageSection<EmailListItem>[] = [{label: null, messages: items}];
        groupPins && r.push(...sortPinned(r.pop()!.messages, getRepresentative));
        groupByDate && r.push(...sortDate(r.pop()!.messages, getRepresentative));
        return r.filter(s => s.messages.length);
    };

    let listItems = $derived(buildListItems(messages, parseBundles));
    let messageSections = $derived(getMessageSections(listItems));

    const getSelectedCommonActions = () =>
        getCommonActions(selection.selected(listItems).flatMap((item) => item.actionMessages));

    let selectedCommonActions = $derived(getSelectedCommonActions());
    let allVisibleSelected = $derived(selection.all(listItems));
    let someVisibleSelected = $derived(selection.some(listItems));

    const panelService: PanelService = getContext(Context.PANEL_SERVICE);
    const toastService: ToastService = getContext(Context.TOAST_SERVICE)
    const gmailOperations: GmailOperationService = getContext(Context.GMAIL_OPERATION_SERVICE)

    const handleMessagesChanged = (
        messageIds: string[],
        previewOpen = false,
    ): boolean | undefined => {
        const changedIds = new Set(messageIds);
        if (messages.some(({id}) => id && changedIds.has(id))) return undefined;
        return previewOpen && activateNextMessage(emailListRoot, new Set(listItems.map((item) => item.key)));
    }

    const handleRemovedSelection = () => {
        const visibleKeys = new Set(listItems.map((item) => item.key));
        const selectedKey = emailListRoot?.querySelector<HTMLElement>('.email.selected')?.dataset.itemKey;
        if (!selectedKey || visibleKeys.has(selectedKey) || activateNextMessage(emailListRoot, visibleKeys)) return;
        const panels = panelService.getPanels();
        const currentPanel = selfSnippet ?? panelService.getInitialPanel();
        const nextPanel = panels[panels.indexOf(currentPanel) + 1];
        if (nextPanel) panelService.close(nextPanel);
    };

    const activateOnKey = (event: KeyboardEvent, action: () => void) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            action();
        }
    }

    async function loadMessages(pageToken?: string, background = false) {
        const sequence = ++loadSequence;
        const generation = messageStore.generation;
        if (!background) loading = true;
        try {
            await gmailOperations.loadMessagePage(query, pageToken);
            if (mounted && sequence === loadSequence && !pageToken && !background) {
                selection.clear();
            }
        } catch (ex) {
            if (!mounted || generation !== messageStore.generation) return;
            toastService.error({
                message: `Failed to load messages`,
                error: formatError(ex),
                action: {
                    label: "Retry",
                    fn: () => loadMessages(pageToken)
                }
            });
        } finally {
            if (sequence === loadSequence) loading = false;
        }
    }

    const handleBundleDrop = async (sourceMessageId: string, target: ParsedMessage) => {
        const source = messages.find((message) => message.id === sourceMessageId);
        if (!source || !target.id || source.id === target.id || bundling) {
            return;
        }

        const title = target.bundleLabelId
            ? undefined
            : requestBundleTitle(target.subject?.trim() || 'New bundle');
        if (!target.bundleLabelId && !title) {
            return;
        }

        bundling = true;
        try {
            await gmailOperations.run(() => createBundle(source, target, title));
            await loadMessages();
            toastService.success({message: target.bundleLabelId ? 'Email added to bundle' : 'Bundle created'});
        } catch (ex) {
            toastService.error({
                message: 'Failed to create bundle',
                error: formatError(ex),
            });
        } finally {
            bundling = false;
        }
    };

    const getSectionDoneAction = (section: MessageSection<EmailListItem>) =>
        getCommonActions(section.messages.flatMap((item) => item.actionMessages))
            .find((action) => action.label === 'Done');

    const markSectionDone = (section: MessageSection<EmailListItem>) => {
        const action = getSectionDoneAction(section);
        if (action) {
            void runBulkAction(action, section.messages);
        }
    };

    const resolveActionTargetIds = async (items: EmailListItem[]) => {
        const targetGroups = await Promise.all(items.map((item) =>
            item.kind === 'bundle'
                ? listAllMessageIds(item.bundleLabelId)
                : Promise.resolve(item.actionMessages.flatMap(({id}) => id ? [id] : []))
        ));
        return [...new Set(targetGroups.flat())];
    };

    const getTargetIds = (items: EmailListItem[]) =>
        [...new Set(items.flatMap((item) => item.actionMessages.flatMap(({id}) => id ? [id] : [])))];

    const itemsPending = (items: EmailListItem[]) => gmailOperations.isPending(getTargetIds(items));

    const runBulkAction = async (
        action: MessageAction,
        items = selection.selected(listItems),
        onOptimistic?: () => void,
    ) => {
        if (!items.length || itemsPending(items)) {
            return;
        }

        let messageIds: string[] = [];
        const knownIds = getTargetIds(items);
        const targets = items.some((item) => item.kind === 'bundle') ? async () => {
            messageIds = await resolveActionTargetIds(items);
            return messageIds;
        } : (messageIds = knownIds);
        const executed = await gmailOperations.runBulkMessageAction(action, targets, {
            optimisticIds: knownIds,
            onOptimistic: () => {
                selection.clear();
                if (onOptimistic) onOptimistic();
                else handleRemovedSelection();
            },
        });
        if (!executed) {
            return;
        }

        toastService.success({
            message: `${action.label}: ${messageIds.length} ${messageIds.length === 1 ? 'message' : 'messages'}`,
        });
    };

    onMount(() => {
        mounted = true;
        void loadMessages();
        return () => { mounted = false; };
    })

    let observedRefresh = query.refreshVersion;
    $effect(() => {
        const version = query.refreshVersion;
        if (version !== observedRefresh) {
            observedRefresh = version;
            untrack(() => { void loadMessages(undefined, true); });
        }
    });

    const requestBundleTitle = (initialTitle = ''): string | undefined => {
        const title = window.prompt('Name this bundle', initialTitle)?.trim();
        if (title === '') {
            toastService.error({message: 'Bundle names cannot be empty'});
            return undefined;
        }
        return title;
    };

    const handleBundleRename = async () => {
        if (bundling || !bundleInfo) {
            return;
        }

        const title = requestBundleTitle(bundleInfo.bundleTitle ?? 'Untitled bundle');
        if (!title || title === bundleInfo.bundleTitle) {
            return;
        }

        bundling = true;
        try {
            await gmailOperations.run(() => renameBundle(bundleInfo.bundleLabelId, title));
            messageStore.renameBundle(bundleInfo.bundleLabelId, title);
            toastService.success({message: 'Bundle renamed'});
        } catch (ex) {
            toastService.error({
                message: 'Failed to rename bundle',
                error: formatError(ex),
            });
        } finally {
            bundling = false;
        }
    };

</script>

{#snippet bundleHeader()}
    <div class="action-bar">
        <div class="action-group">
            <button
                    class="icon-button"
                    tabindex="0"
                    onclick={() => panelService.close(selfSnippet!)}
                    title="Close panel"
            >
                <span class="icon">keyboard_arrow_right</span>
            </button>
        </div>
        <div class="action-group">
            <button
                    class="icon-button"
                    onclick={handleBundleRename}
                    title="Rename bundle"
            >
                <span class="icon">edit</span>
            </button>
        </div>
    </div>
    <span class="list-title">
        {bundleInfo!.bundleTitle ?? 'Untitled bundle'}
    </span>
{/snippet}

<div class="panel email-list">
    {#if bundleInfo}
        {@render bundleHeader()}
    {/if}
    <div class="action-bar">
        <div class="action-group">
            <button
                class="icon-button"
                aria-label={allVisibleSelected ? 'Clear selection' : 'Select all'}
                title={allVisibleSelected ? 'Clear selection' : 'Select all'}
                disabled={!listItems.length || loading}
                onclick={() => selection.toggle(listItems)}
            >
                <span class="icon">
                    {allVisibleSelected
                        ? 'check_box'
                        : (someVisibleSelected ? 'indeterminate_check_box' : 'check_box_outline_blank')}
                </span>
            </button>
            {#if selection.active}
                {#each selectedCommonActions as action (action.label)}
                    <button
                        class:active={action.isActive}
                        class="icon-button"
                        aria-label={`${action.label} selected`}
                        title={action.label}
                        disabled={itemsPending(selection.selected(listItems))}
                        onclick={() => runBulkAction(action)}
                    >
                        <span class="icon">{action.icon}</span>
                    </button>
                {/each}
            {/if}
        </div>
        <div class="action-group">
            <button
                    class="icon-button"
                    disabled={loading}
                    tabindex="0"
                    onclick={() => loadMessages()}
                    onkeydown={(event) => activateOnKey(event, () => loadMessages())}
            >
                <span class="icon">refresh</span>
            </button>
        </div>
    </div>
    {#if !messages.length && loading}
        <span>Loading messages...</span>
    {:else if messages.length === 0}
        <span>No messages found.</span>
    {:else}
        <div
            class="emailList"
            bind:this={emailListRoot}
            use:emailListNavigation={{panelService}}
        >
            {#each messageSections as section (section.label)}
                {#if section.label}
                    <SectionHeader
                            label={section.label}
                            checked={selection.state(section.messages)}
                            onCheckChanged={(checked) => selection.set(section.messages, checked)}
                            selectionActive={selection.active}
                            onSectionDone={getSectionDoneAction(section) && (() => markSectionDone(section))}
                            busy={itemsPending(section.messages)}
                    />
                {/if}
                {#each section.messages as item (item.key)}
                    {@const message = item.representative}
                    {#if item.kind === 'bundle'}
                        <BundleListEntry
                            representative={message}
                            bundleListItem={item}
                            checked={selection.has(item)}
                            showCheckbox={selection.active}
                            onCheckedChange={(checked) => selection.set([item], checked)}
                            onBundleDrop={handleBundleDrop}
                            onRunAction={(action, onOptimistic) => runBulkAction(action, [item], onOptimistic)}
                            onMessagesChanged={handleMessagesChanged}
                            actions={getCommonActions(item.actionMessages)}
                            parentListSnippet={selfSnippet ?? panelService.getInitialPanel()}
                        />
                    {:else}
                        <EmailListEntry
                            message={message}
                            threadMessages={item.actionMessages}
                            checked={selection.has(item)}
                            showCheckbox={selection.active}
                            onCheckedChange={(checked) => selection.set([item], checked)}
                            onBundleDrop={parseBundles ? handleBundleDrop : undefined}
                            onMessagesChanged={handleMessagesChanged}
                            parentListSnippet={selfSnippet ?? panelService.getInitialPanel()}
                        />
                    {/if}
                {/each}
            {/each}
        </div>
        {#if nextPageToken}
            <div class="more">
                <button onclick={() => loadMessages(nextPageToken)} disabled={loading}>
                    {loading ? 'Loading messages...' : 'Load more'}
                </button>
            </div>
        {/if}
    {/if}
</div>

<style>
    span {
        text-align: center;
    }

    .more button {
        margin-top: 5px;
    }

    .list-title {
        font-size: larger;
        align-items: center;
        display: flex;
        margin-bottom: 5px;
        gap: 5px;
    }

    .email-list {
        gap: 5px;
    }
</style>
