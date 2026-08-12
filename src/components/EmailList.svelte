<script lang="ts">
    import {getContext, onMount} from "svelte";
    import {Context} from "../Context";
    import EmailListEntry from "./EmailListEntry.svelte";
    import BundleListEntry from "./BundleListEntry.svelte";
    import {
        formatError,
        type MessagePage,
        type ParsedMessage,
    } from "../services/GmailService";
    import {
        createBundle,
        listAllMessageIds,
    } from "../services/BundleService";
    import {PanelService} from "../services/PanelService.svelte";
    import {ToastService} from "../services/ToastService.svelte";
    import {MessageActionService} from "../services/MessageActionService.svelte";
    import {type MessageSection, sortDate, sortPinned} from "../MessageSorter";
    import {buildListItems, type EmailListItem} from "../EmailListItem";
    import {Selection} from "../Selection.svelte";
    import {
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
    const selection = new Selection<EmailListItem>((item) => item.key);

    const getRepresentative = (item: EmailListItem) => item.representative;

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
    const messageActionService: MessageActionService = getContext(Context.MESSAGE_ACTION_SERVICE)

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
                selection.clear();
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

    const handleBundleDrop = async (sourceMessageId: string, target: ParsedMessage) => {
        const source = messages.find((message) => message.id === sourceMessageId);
        if (!source || !target.id || source.id === target.id || bundling) {
            return;
        }

        const title = target.bundleLabelId
            ? undefined
            : 'New bundle'
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
                : Promise.resolve(item.representative.id ? [item.representative.id] : [])
        ));
        return [...new Set(targetGroups.flat())];
    };

    const runBulkAction = async (action: MessageAction, items = selection.selected(listItems)) => {
        if (!items.length || messageActionService.busy) {
            return;
        }

        let messageIds: string[] = [];
        const executed = await messageActionService.runBulk(action, async () => {
            messageIds = await resolveActionTargetIds(items);
            return messageIds;
        });
        if (!executed) {
            return;
        }

        await loadMessages();
        toastService.success({
            message: `${action.label}: ${messageIds.length} ${messageIds.length === 1 ? 'message' : 'messages'}`,
        });
    };

    onMount(() => {
        void loadMessages();
    })
</script>

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
                disabled={!listItems.length || loading || messageActionService.busy}
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
                        disabled={messageActionService.busy}
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
                            checked={selection.state(section.messages)}
                            onCheckChanged={(checked) => selection.set(section.messages, checked)}
                            selectionActive={selection.active}
                            onSectionDone={getSectionDoneAction(section) && (() => markSectionDone(section))}
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
                            onRunAction={(action) => runBulkAction(action, [item])}
                            actions={getCommonActions(item.actionMessages)}
                        />
                    {:else}
                        <EmailListEntry
                            message={message}
                            checked={selection.has(item)}
                            showCheckbox={selection.active}
                            onCheckedChange={(checked) => selection.set([item], checked)}
                            onBundleDrop={parseBundles ? handleBundleDrop : undefined}
                            onMessageChanged={handleMessageChanged}
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
