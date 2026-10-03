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

  const toastService = new ToastService()
  setContext(Context.TOAST_SERVICE, toastService)

  const gmailOperationService = new GmailOperationService(toastService)
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
</script>

{#if authService.authenticated}
  {#key authService.profile?.emailAddress}
    <Main/>
  {/key}
{:else}
  <Login/>
{/if}

{#if authService.refreshRequired}
  <div class="refresh-backdrop">
    <div class="refresh-dialog" role="dialog" aria-modal="true" aria-labelledby="refresh-title">
      <span class="icon" aria-hidden="true">key</span>
      <h2 id="refresh-title">Reconnect to Google</h2>
      <p>Your Google access is about to expire. Continue to keep using your mailbox.</p>
      <button onclick={() => authService.refreshAccess()} disabled={authService.busy}>
        {authService.busy ? 'Connecting…' : 'Continue with Google'}
      </button>
    </div>
  </div>
{/if}

<ToastHost service={toastService}/>

<style>
  .refresh-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: grid;
    place-items: center;
    padding: 20px;
    background: rgba(0, 0, 0, 0.72);
  }

  .refresh-dialog {
    box-sizing: border-box;
    width: min(420px, 100%);
    padding: 24px;
    border-radius: 10px;
    background: #212121;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
    text-align: center;
  }

  .refresh-dialog .icon {
    font-size: 42px;
    color: #e083ff;
  }

  .refresh-dialog h2 {
    margin: 10px 0 8px;
  }

  .refresh-dialog p {
    margin: 0 0 18px;
    color: rgba(255, 255, 255, 0.78);
  }

  .refresh-dialog button {
    margin: 0 auto;
  }
</style>
