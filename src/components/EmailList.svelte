<script lang="ts">
    import EmailListEntry from "./EmailListEntry.svelte";
    import {formatError, listMessagePage, type ParsedMessage} from "../services/GmailService";

    let {
        id,
        mailbox,
        query,
        labelIds,
    }: {
        id: number,
        mailbox?: string,
        query?: string,
        labelIds?: string[],
    } = $props()

    let messages: ParsedMessage[] = $state([]);
    let nextPageToken: string | undefined = $state();
    let loading = $state(true);
    let error: unknown = $state();

    const handleMessageChanged = (
        messageId: string,
        changes: Partial<ParsedMessage>,
        removeFromList = false,
    ) => {
        messages = removeFromList
            ? messages.filter(({id}) => id !== messageId)
            : messages.map((message) => message.id === messageId ? {...message, ...changes} : message);
    }

    const activateOnKey = (event: KeyboardEvent, action: () => void) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            action();
        }
    }

    const loadMessages = async (pageToken?: string) => {
        loading = true;
        error = undefined;

        if (!pageToken) {
            messages = [];
        }

        try {
            const page = await listMessagePage({pageToken, query, labelIds});
            messages = pageToken ? [...messages, ...page.messages] : page.messages;
            nextPageToken = page.nextPageToken;
        } catch (ex) {
            error = ex;
        }

        loading = false;
    }

    loadMessages();
</script>

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
    {:else if error}
        <span>Error loading messages!</span>
        <code>{formatError(error)}</code>
        <button onclick={() => loadMessages()}>Retry</button>
    {:else if messages.length === 0}
        <span>No messages found.</span>
    {:else}
        <div class="emailList">
            {#each messages as message}
                <EmailListEntry
                    message={message}
                    {mailbox}
                    onMessageChanged={handleMessageChanged}
                />
            {/each}
        </div>
        {#if nextPageToken}
            <div>
                <button onclick={() => loadMessages(nextPageToken)} disabled={loading}>
                    {loading ? 'Loading messages...' : 'Load more'}
                </button>
            </div>
        {/if}
    {/if}
</div>
