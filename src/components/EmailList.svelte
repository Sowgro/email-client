<script lang="ts">
    import EmailListEntry from "./EmailListEntry.svelte";
    import {formatError, listMessagePage, type ParsedMessage} from "../services/GmailService";

    let messages: ParsedMessage[] = $state([]);
    let nextPageToken: string | undefined = $state();
    let loading = $state(true);
    let loadingMore = $state(false);
    let error: unknown = $state();

    const activateOnKey = (event: KeyboardEvent, action: () => void) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            action();
        }
    }

    const loadMessages = async (pageToken?: string) => {
        if (pageToken) {
            loadingMore = true;
        } else {
            loading = true;
            messages = [];
            nextPageToken = undefined;
        }

        error = undefined;

        try {
            const page = await listMessagePage(pageToken);
            messages = pageToken ? [...messages, ...page.messages] : page.messages;
            nextPageToken = page.nextPageToken;
        } catch (ex) {
            error = ex;
        } finally {
            loading = false;
            loadingMore = false;
        }
    }

    loadMessages();
</script>

<div class="panel">
    <div class="action-bar">
        <div></div>
        <div>
            <button
                    class="icon-button"
                    disabled={loading || loadingMore}
                    tabindex="0"
                    onclick={() => loadMessages()}
                    onkeydown={(event) => activateOnKey(event, () => loadMessages())}
            >
                <div class="icon">refresh</div>
            </button>
        </div>
    </div>
    {#if loading}
        <span>Loading messages...</span>
    {:else if error}
        <span>Error loading messages!</span>
        <code>{formatError(error)}</code>
        <button onclick={() => loadMessages()}>Retry</button>
    {:else if messages.length === 0}
        <span>No messages found.</span>
        <button onclick={() => loadMessages()}>Refresh</button>
    {:else}
        <div class="emailList">
            {#each messages as message}
                <EmailListEntry message={message}/>
            {/each}
        </div>
        {#if nextPageToken}
            <div>
                <button onclick={() => loadMessages(nextPageToken)} disabled={loadingMore}>
                    {loadingMore ? 'Loading messages...' : 'Load more'}
                </button>
            </div>
        {/if}
    {/if}
</div>
