<script lang="ts">
  import {onMount, setContext} from "svelte";
  import Main from "./pages/Main.svelte";
  import Login from "./pages/Login.svelte";
  import ToastHost from "./components/ToastHost.svelte";
  import {ToastService} from "./services/ToastService.svelte";
  import {Context} from "./Context";
  import {Router} from "./services/Router.svelte";
  import {AuthService} from "./services/AuthService.svelte";

  const toastService = new ToastService()
  setContext(Context.TOAST_SERVICE, toastService)

  const router = new Router()
  setContext(Context.ROUTER, router)

  const authService = new AuthService()
  setContext(Context.AUTH_SERVICE, authService)

  onMount(() => {
    authService.initialize()

    return () => {
      authService.destroy()
      router.destroy()
    }
  })
</script>

{#if authService.authenticated}
  <Main/>
{:else}
  <Login/>
{/if}

<ToastHost service={toastService}/>
