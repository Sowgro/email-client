<script lang="ts">
    import {onMount, setContext} from "svelte";
    import Main from "./pages/Main.svelte";
    import Login from "./pages/Login.svelte";
    import ToastHost from "./components/ToastHost.svelte";
    import {ToastService} from "./services/ToastService.svelte";
    import {Context} from "./Context";
    import {Router} from "./services/Router.svelte";
    import {AuthService} from "./services/AuthService.svelte";
    import {GmailOperationService} from "./services/GmailOperationService.svelte";
    import {SenderAvatarService} from "./services/SenderAvatarService";
    import {MessageStore} from "./services/MessageStore.svelte";

    const toastService = new ToastService()
    setContext(Context.TOAST_SERVICE, toastService)

    const messageStore = new MessageStore()
    setContext(Context.MESSAGE_STORE, messageStore)

    const gmailOperationService = new GmailOperationService(toastService, messageStore)
    setContext(Context.GMAIL_OPERATION_SERVICE, gmailOperationService)

    const router = new Router()
    setContext(Context.ROUTER, router)

    const authService = new AuthService(gmailOperationService)
    setContext(Context.AUTH_SERVICE, authService)

    const senderAvatarService = new SenderAvatarService()
    setContext(Context.SENDER_AVATAR_SERVICE, senderAvatarService)

    $effect(() => {
        senderAvatarService.setAccount(authService.profile?.emailAddress)
    })

    onMount(() => {
        authService.initialize()

        return () => {
            authService.destroy()
            router.destroy()
        }
    })

    document.addEventListener('click', ev => {
        if (authService.refreshRequired) {
            ev.stopPropagation();
            authService.refreshAccess();
        }
    })
</script>

{#if authService.authenticated}
    {#key authService.profile?.emailAddress}
        <Main/>
    {/key}
{:else}
    <Login/>
{/if}

<ToastHost service={toastService}/>
