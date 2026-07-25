<script lang="ts">
  import {setContext} from "svelte";
  import Main from "./pages/Main.svelte";
  import Login from "./pages/Login.svelte";
  import ToastHost from "./components/ToastHost.svelte";
  import {ToastService} from "./services/ToastService.svelte";
  import {Context} from "./Context";

  let loggedIn: boolean = $state(false)

  const toastService = new ToastService()
  setContext(Context.TOAST_SERVICE, toastService)
</script>

{#if loggedIn}
  <Main/>
{:else}
  <Login bind:loggedIn={loggedIn}/>
{/if}

<ToastHost service={toastService}/>
