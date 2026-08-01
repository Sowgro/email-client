<script lang="ts">
    import {getContext, onMount} from "svelte";
    import {Context} from "../Context";
    import EmailListEntry from "./EmailListEntry.svelte";
    import {formatError, type MessagePage, type ParsedMessage} from "../services/GmailService";
    import {PanelService} from "../services/PanelService.svelte";
    import {ToastService} from "../services/ToastService.svelte";

    let {
        getMessages
    }: {
        getMessages: (pageToken?: string) => Promise<MessagePage>
    } = $props()

    let messages: ParsedMessage[] = $state([]);
    let nextPageToken: string | undefined = $state();
    let loading = $state(true);
    let emailListRoot: HTMLDivElement | undefined = $state();

    const panelService: PanelService = getContext(Context.PANEL_SERVICE);
    const toastService: ToastService = getContext(Context.TOAST_SERVICE)

    const getSelectedMessage = () =>
        emailListRoot?.querySelector<HTMLElement>('.email.selected');

    const isTextEntry = (target: EventTarget | null) =>
        target instanceof HTMLElement
        && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));

    const handleWindowKeydown = (event: KeyboardEvent) => {
        if (
            panelService.panels.length < 2
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

        const nextMessage = (
            event.key === 'ArrowUp'
                ? selectedMessage?.previousElementSibling
                : selectedMessage?.nextElementSibling
        ) as HTMLElement | null;

        if (!nextMessage?.classList.contains('email')) {
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
        const nextMessage = selectedMessage?.nextElementSibling as HTMLElement | null;
        const hasNextMessage = Boolean(nextMessage?.classList.contains('email'));

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

    function loadMessages(pageToken?: string) {
        loading = true;
        getMessages(pageToken).then(page => {
            messages = pageToken ? [...messages, ...page.messages] : page.messages;
            nextPageToken = page.nextPageToken;
        }).catch(ex => {
            toastService.error(`Failed to load messages: ${formatError(ex)}`)
        }).finally(() => {
            loading = false;
        })
    }

    onMount(() => {
        loadMessages();
    })
</script>

<svelte:window onkeydown={handleWindowKeydown}/>

<div class="panel">
    <div class="action-bar">
        <div></div>
        <div>
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
        <div class="emailList" bind:this={emailListRoot}>
            {#each messages as message (message.id ?? message)}
                <EmailListEntry
                    message={message}
                    onMessageChanged={handleMessageChanged}
                />
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
</style>
