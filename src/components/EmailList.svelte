<script lang="ts">
    import {getContext, onMount} from "svelte";
    import {Context} from "../Context";
    import EmailListEntry from "./EmailListEntry.svelte";
    import BundleListEntry from "./BundleListEntry.svelte";
    import EmailList from "./EmailList.svelte";
    import {
        createBundle,
        formatError,
        listMessagePage,
        renameBundle,
        type MessagePage,
        type ParsedMessage,
    } from "../services/GmailService";
    import {PanelService} from "../services/PanelService.svelte";
    import {ToastService} from "../services/ToastService.svelte";
    import {type MessageSection, sortDate, sortPinned} from "../MessageSorter";

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

    let messageSections = $derived(getMessageSections(getVisibleMessages(messages)));

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
                    <h2 class="section-heading">{section.label}</h2>
                {/if}
                {#each section.messages as message (message.id ?? message)}
                    {#if parseBundles && message.bundleLabelId}
                        <BundleListEntry
                            representative={message}
                            selected={message.bundleLabelId === selectedBundleLabelId
                                && panelService.panels.includes(bundleList)}
                            onOpen={openBundle}
                            onBundleDrop={handleBundleDrop}
                            onRename={handleBundleRename}
                        />
                    {:else}
                        <EmailListEntry
                            message={message}
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

    .section-heading {
        color: rgba(255, 255, 255, 0.62);
        font-size: 0.78rem;
        font-weight: 600;
        letter-spacing: 0.08em;
        margin: 18px 7px 6px;
        text-transform: uppercase;
    }

    .section-heading:first-child {
        margin-top: 8px;
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
