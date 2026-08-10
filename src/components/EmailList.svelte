<script lang="ts">
    import {getContext, onMount} from "svelte";
    import {Context} from "../Context";
    import EmailListEntry from "./EmailListEntry.svelte";
    import BundleListEntry from "./BundleListEntry.svelte";
    import EmailList from "./EmailList.svelte";
    import {
        formatError,
        listMessagePage,
        type MessagePage,
        type ParsedMessage,
    } from "../services/GmailService";
    import {
        createBundle,
        listAllMessageIds,
        renameBundle,
    } from "../services/BundleService";
    import {PanelService} from "../services/PanelService.svelte";
    import {ToastService} from "../services/ToastService.svelte";
    import {type MessageSection, sortDate, sortPinned} from "../MessageSorter";
    import {
        executeMessageAction,
        getCommonActions,
        type MessageAction,
    } from "../MessageActions";
    import SectionHeader from "./SectionHeader.svelte";

    let {
        getMessages,
        groupByDate = false,
        groupPins = false,
        parseBundles = true,
        bundleTitle,
    }: {
        getMessages: (pageToken?: string) => Promise<MessagePage>,
        groupByDate?: boolean,
        groupPins?: boolean,
        parseBundles?: boolean,
        bundleTitle?: string,
    } = $props()

    let messages: ParsedMessage[] = $state([]);
    let nextPageToken: string | undefined = $state();
    let loading = $state(true);
    let bundling = $state(false);
    let emailListRoot: HTMLDivElement | undefined = $state();
    let selectedBundleLabelId: string | undefined = $state();
    let selectedBundleTitle: string | undefined = $state();
    let selectedItemKeys: Set<string> = $state(new Set());
    let actionBusy = $state(false);

    const getVisibleMessages = (items: ParsedMessage[]) => {
        if (!parseBundles) {
            return items;
        }

        const seenBundleIds = new Set<string>();
        return items.filter((message) => {
            if (!message.bundleLabelId) {
                return true;
            }
            if (seenBundleIds.has(message.bundleLabelId)) {
                return false;
            }
            seenBundleIds.add(message.bundleLabelId);
            return true;
        });
    };

    const getMessageSections = (items: ParsedMessage[]): MessageSection[] => {
        let r: MessageSection[] = [{label: null, messages: items}];
        groupPins && r.push(...sortPinned(r.pop()!.messages));
        groupByDate && r.push(...sortDate(r.pop()!.messages));
        return r.filter(s => s.messages.length);
    };

    let visibleMessages = $derived(getVisibleMessages(messages));
    let messageSections = $derived(getMessageSections(visibleMessages));

    const getItemKey = (message: ParsedMessage) =>
        parseBundles && message.bundleLabelId
            ? `bundle:${message.bundleLabelId}`
            : `message:${message.id}`;

    const getItemActionMessages = (message: ParsedMessage) =>
        parseBundles && message.bundleLabelId
            ? (message.bundleSummary?.messages ?? [message])
            : [message];

    const getSelectedItems = () =>
        visibleMessages.filter((message) => selectedItemKeys.has(getItemKey(message)));

    const getSelectedCommonActions = () =>
        getCommonActions(getSelectedItems().flatMap(getItemActionMessages));

    let selectedCommonActions = $derived(getSelectedCommonActions());
    let selectionActive = $derived(selectedItemKeys.size > 0);
    let visibleItemKeys = $derived(visibleMessages.map(getItemKey));
    let allVisibleSelected = $derived(
        Boolean(visibleItemKeys.length)
        && visibleItemKeys.every((key) => selectedItemKeys.has(key))
    );
    let someVisibleSelected = $derived(
        visibleItemKeys.some((key) => selectedItemKeys.has(key))
    );

    const panelService: PanelService = getContext(Context.PANEL_SERVICE);
    const toastService: ToastService = getContext(Context.TOAST_SERVICE)

    const getSelectedMessage = () =>
        emailListRoot?.querySelector<HTMLElement>('.email.selected');

    const isTextEntry = (target: EventTarget | null) =>
        target instanceof HTMLElement
        && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));

    const handleWindowKeydown = (event: KeyboardEvent) => {
        const currentPanelSlot = emailListRoot?.closest('.panel-slot');
        const panelSlots = Array.from(
            emailListRoot?.closest('#panels')?.querySelectorAll(':scope > .panel-slot') ?? []
        );
        const currentPanelIndex = currentPanelSlot ? panelSlots.indexOf(currentPanelSlot) : -1;

        if (
            panelService.panels.length < 2
            || currentPanelIndex !== panelService.panels.length - 2
            || event.isComposing
            || isTextEntry(event.target)
            || emailListRoot?.closest('#panels')?.querySelector('[role="menu"]')
        ) {
            return;
        }

        const selectedMessage = getSelectedMessage();

        if (event.key === 'Escape') {
            event.preventDefault();
            selectedMessage?.focus();
            panelService.panels = panelService.panels.slice(0, -1);
            return;
        }

        if (
            (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')
            || event.altKey
            || event.ctrlKey
            || event.metaKey
            || event.shiftKey
        ) {
            return;
        }

        const listedMessages = Array.from(
            emailListRoot?.querySelectorAll<HTMLElement>('.email') ?? []
        );
        const selectedIndex = selectedMessage ? listedMessages.indexOf(selectedMessage) : -1;
        const nextIndex = selectedIndex + (event.key === 'ArrowUp' ? -1 : 1);
        const nextMessage = listedMessages[nextIndex];

        if (!nextMessage) {
            return;
        }

        event.preventDefault();
        nextMessage.click();
        nextMessage.focus();
        nextMessage.scrollIntoView({block: 'nearest'});
    };

    const handleMessageChanged = (
        messageId: string,
        changes: Partial<ParsedMessage>,
        removeFromList = false,
    ): boolean => {
        if (!removeFromList) {
            messages = messages.map((message) =>
                message.id === messageId ? {...message, ...changes} : message
            );
            return false;
        }

        const selectedMessage = getSelectedMessage();
        const listedMessages = Array.from(
            emailListRoot?.querySelectorAll<HTMLElement>('.email') ?? []
        );
        const selectedIndex = selectedMessage ? listedMessages.indexOf(selectedMessage) : -1;
        const nextMessage = listedMessages[selectedIndex + 1];
        const hasNextMessage = Boolean(nextMessage);

        if (hasNextMessage) {
            nextMessage!.click();
            nextMessage!.focus();
            nextMessage!.scrollIntoView({block: 'nearest'});
        }

        messages = messages.filter(({id}) => id !== messageId);
        return hasNextMessage;
    }

    const activateOnKey = (event: KeyboardEvent, action: () => void) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            action();
        }
    }

    async function loadMessages(pageToken?: string) {
        loading = true;
        try {
            const page = await getMessages(pageToken);
            messages = pageToken ? [...messages, ...page.messages] : page.messages;
            nextPageToken = page.nextPageToken;
            if (!pageToken) {
                selectedItemKeys = new Set();
            }
        } catch (ex) {
            toastService.error({
                message: `Failed to load messages`,
                error: formatError(ex),
                action: {
                    label: "Retry",
                    fn: () => loadMessages(pageToken)
                }
            });
        } finally {
            loading = false;
        }
    }

    const requestBundleTitle = (initialTitle = ''): string | undefined => {
        const title = window.prompt('Name this bundle', initialTitle)?.trim();
        if (title === '') {
            toastService.error({message: 'Bundle names cannot be empty'});
            return undefined;
        }
        return title;
    };

    const openBundle = (bundleLabelId: string, bundleTitle?: string) => {
        selectedBundleLabelId = bundleLabelId;
        selectedBundleTitle = bundleTitle;
        panelService.openNextTo(emailListRoot, bundleList);
    };

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
            await createBundle(source, target, title);
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

    const handleBundleRename = async (bundleLabelId: string, bundleTitle?: string) => {
        if (bundling) {
            return;
        }

        const title = requestBundleTitle(bundleTitle ?? 'Untitled bundle');
        if (!title || title === bundleTitle) {
            return;
        }

        bundling = true;
        try {
            await renameBundle(bundleLabelId, title);
            messages = messages.map((listedMessage) =>
                listedMessage.bundleLabelId === bundleLabelId
                    ? {...listedMessage, bundleTitle: title}
                    : listedMessage
            );
            if (selectedBundleLabelId === bundleLabelId) {
                selectedBundleTitle = title;
            }
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

    const setItemsChecked = (keys: string[], checked: boolean) => {
        const nextSelection = new Set(selectedItemKeys);
        for (const key of keys) {
            checked ? nextSelection.add(key) : nextSelection.delete(key);
        }
        selectedItemKeys = nextSelection;
    };

    const setItemChecked = (message: ParsedMessage, checked: boolean) =>
        setItemsChecked([getItemKey(message)], checked);

    const toggleAllVisible = () =>
        setItemsChecked(visibleItemKeys, !allVisibleSelected);

    const getSectionKeys = (section: MessageSection) =>
        section.messages.map(getItemKey);

    const isSectionSelected = (section: MessageSection) => {
        const keys = getSectionKeys(section);
        return Boolean(keys.length) && keys.every((key) => selectedItemKeys.has(key));
    };

    const isSectionPartiallySelected = (section: MessageSection) => {
        const keys = getSectionKeys(section);
        return !isSectionSelected(section) && keys.some((key) => selectedItemKeys.has(key));
    };

    const toggleSection = (section: MessageSection) =>
        setItemsChecked(getSectionKeys(section), !isSectionSelected(section));

    const getSectionDoneAction = (section: MessageSection) =>
        getCommonActions(section.messages.flatMap(getItemActionMessages))
            .find((action) => action.label === 'Done');

    const markSectionDone = (section: MessageSection) => {
        const action = getSectionDoneAction(section);
        if (action) {
            void runBulkAction(action, section.messages);
        }
    };

    const resolveActionTargetIds = async (items: ParsedMessage[]) => {
        const targetGroups = await Promise.all(items.map((message) =>
            parseBundles && message.bundleLabelId
                ? listAllMessageIds(message.bundleLabelId)
                : Promise.resolve(message.id ? [message.id] : [])
        ));
        return [...new Set(targetGroups.flat())];
    };

    const runBulkAction = async (action: MessageAction, items = getSelectedItems()) => {
        if (!items.length || actionBusy) {
            return;
        }

        actionBusy = true;
        try {
            const messageIds = await resolveActionTargetIds(items);
            const executed = await executeMessageAction(action, messageIds);
            if (!executed) {
                return;
            }

            await loadMessages();
            toastService.success({
                message: `${action.label}: ${messageIds.length} ${messageIds.length === 1 ? 'message' : 'messages'}`,
            });
        } catch (ex) {
            toastService.error({
                message: `Failed to ${action.label.toLowerCase()}`,
                error: formatError(ex),
            });
        } finally {
            actionBusy = false;
        }
    };

    onMount(() => {
        void loadMessages();
    })
</script>

{#snippet bundleList()}
    {#if selectedBundleLabelId}
        <EmailList
            getMessages={(pageToken?: string) => listMessagePage({
                pageToken,
                labelIds: [selectedBundleLabelId!],
                includeSpamTrash: true,
                includeBundleSummaries: false,
            })}
            groupByDate
            parseBundles={false}
            bundleTitle={selectedBundleTitle ?? 'Untitled bundle'}
        />
    {/if}
{/snippet}

<svelte:window onkeydown={handleWindowKeydown}/>

<div class="panel email-list">
    <div class="action-bar">
        <div class="action-group">
            {#if bundleTitle}
                <button
                        class="icon-button"
                        tabindex="0"
                        onclick={() => panelService.removeLast()}
                >
                    <span class="icon">keyboard_arrow_right</span>
                </button>
            {/if}
            <button
                class="icon-button"
                aria-label={allVisibleSelected ? 'Clear selection' : 'Select all'}
                title={allVisibleSelected ? 'Clear selection' : 'Select all'}
                disabled={!visibleItemKeys.length || loading || actionBusy}
                onclick={toggleAllVisible}
            >
                <span class="icon">
                    {allVisibleSelected
                        ? 'check_box'
                        : (someVisibleSelected ? 'indeterminate_check_box' : 'check_box_outline_blank')}
                </span>
            </button>
            {#if selectionActive}
                {#each selectedCommonActions as action (action.label)}
                    <button
                        class:active={action.isActive}
                        class="icon-button"
                        aria-label={`${action.label} selected`}
                        title={action.label}
                        disabled={actionBusy}
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
    {#if bundleTitle}
        <span class="list-title"><span class="icon">inbox</span>{bundleTitle}</span>
    {/if}
    {#if !messages.length && loading}
        <span>Loading messages...</span>
    {:else if messages.length === 0}
        <span>No messages found.</span>
    {:else}
        <div class="emailList" bind:this={emailListRoot}>
            {#each messageSections as section (section.label)}
                {#if section.label}
                    <SectionHeader
                            label={section.label}
                            checked={isSectionPartiallySelected(section) ? 'partial' : isSectionSelected(section)}
                            onCheckChanged={() => toggleSection(section)}
                            selectionActive={selectionActive}
                            actionBusy={actionBusy}
                            onSectionDone={getSectionDoneAction(section) && (() => markSectionDone(section))}
                    />
                {/if}
                {#each section.messages as message (message.id ?? message)}
                    {#if parseBundles && message.bundleLabelId}
                        <BundleListEntry
                            representative={message}
                            selected={message.bundleLabelId === selectedBundleLabelId
                                && panelService.panels.includes(bundleList)}
                            checked={selectedItemKeys.has(getItemKey(message))}
                            showCheckbox={selectionActive}
                            actions={getCommonActions(getItemActionMessages(message))}
                            {actionBusy}
                            onOpen={openBundle}
                            onBundleDrop={handleBundleDrop}
                            onRename={handleBundleRename}
                            onCheckedChange={(checked) => setItemChecked(message, checked)}
                            onRunAction={(action) => runBulkAction(action, [message])}
                        />
                    {:else}
                        <EmailListEntry
                            message={message}
                            checked={selectedItemKeys.has(getItemKey(message))}
                            showCheckbox={selectionActive}
                            onCheckedChange={(checked) => setItemChecked(message, checked)}
                            onMessageChanged={handleMessageChanged}
                            onBundleDrop={parseBundles ? handleBundleDrop : undefined}
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
