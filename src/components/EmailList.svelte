<script lang="ts">
    import EmailListEntry from "./EmailListEntry.svelte";

    const getMessageList = async () => {
        let res = await gapi.client.gmail.users.messages.list({'userId': 'me'});
        return res.result;
    }
</script>

<div class="panel">
    {#await getMessageList()}
        <span>Loading messages...</span>
    {:then res}
        <div class="emailList">
            {#each res.messages as message}
                <EmailListEntry baseMessage={message}/>
            {/each}
        </div>
    {:catch ex}
        <span>Error loading messages!</span><code>{ex}</code>
    {/await}
</div>